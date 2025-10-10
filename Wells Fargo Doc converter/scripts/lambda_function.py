import os, io, csv, json, re, hashlib
from typing import Tuple, Optional, Dict, Any, List
from datetime import datetime
import uuid
import boto3

# --- Config ---
REGION = os.environ.get("AWS_REGION", "us-east-2")
OUTPUT_BUCKET = os.environ["OUTPUT_BUCKET"]
OUTPUT_PREFIX = os.environ.get("OUTPUT_PREFIX", "parsed/").rstrip("/") + "/"

# Optional OFX/QBO metadata
BANK_ID  = os.environ.get("BANK_ID",  "123456")
ACCT_ID  = os.environ.get("ACCT_ID",  "000000000")
ACCT_TYPE= os.environ.get("ACCT_TYPE","CHECKING")  # CHECKING|SAVINGS|CREDITLINE|MONEYMRKT
FI_ORG   = os.environ.get("FI_ORG",   "CHASE BANK")
FI_FID   = os.environ.get("FI_FID",   "00000")
INTU_BID = os.environ.get("INTU_BID", "2430")

s3 = boto3.client("s3", region_name=REGION)
tx = boto3.client("textract", region_name=REGION)

# ---------- Textract helpers ----------
def _iter_pages(job_id: str):
    token = None
    while True:
        kw = {"JobId": job_id}
        if token:
            kw["NextToken"] = token
        res = tx.get_document_analysis(**kw)
        yield res
        token = res.get("NextToken")
        if not token:
            break

def _block_map(blocks):
    return {b["Id"]: b for b in blocks}

def _extract_text(block, by_id):
    parts = []
    for rel in block.get("Relationships", []):
        if rel["Type"] != "CHILD":
            continue
        for cid in rel["Ids"]:
            c = by_id[cid]
            bt = c["BlockType"]
            if bt == "WORD":
                parts.append(c.get("Text",""))
            elif bt == "SELECTION_ELEMENT" and c.get("SelectionStatus") == "SELECTED":
                parts.append("[X]")
    return " ".join(parts).strip()

def _tables_from_blocks(blocks):
    """
    Yields (table_block, grid) where grid is a 2D list of strings.
    Handles simple RowSpan/ColumnSpan by filling the span.
    """
    by_id = _block_map(blocks)
    for t in (b for b in blocks if b["BlockType"] == "TABLE"):
        cells = []
        for rel in t.get("Relationships", []):
            if rel["Type"] == "CHILD":
                for cid in rel["Ids"]:
                    cb = by_id[cid]
                    if cb["BlockType"] == "CELL":
                        cells.append(cb)
        if not cells:
            continue
        max_row = max(c.get("RowIndex",1) + c.get("RowSpan",1) - 1 for c in cells)
        max_col = max(c.get("ColumnIndex",1) + c.get("ColumnSpan",1) - 1 for c in cells)
        grid = [["" for _ in range(max_col)] for _ in range(max_row)]

        for c in cells:
            r0 = c.get("RowIndex",1)-1
            c0 = c.get("ColumnIndex",1)-1
            rs = max(1, c.get("RowSpan",1))
            cs = max(1, c.get("ColumnSpan",1))
            text = _extract_text(c, by_id)
            for rr in range(r0, r0+rs):
                for cc in range(c0, c0+cs):
                    if grid[rr][cc] == "":
                        grid[rr][cc] = text
        yield t, grid

# ---------- Event helpers ----------
def _extract_job_from_event(event: Dict[str, Any]) -> Tuple[str, Optional[dict], Optional[str]]:
    # SNS
    if isinstance(event, dict) and "Records" in event:
        rec0 = event["Records"][0]
        if rec0.get("EventSource") == "aws:sns":
            msg_raw = rec0["Sns"]["Message"]
            msg = json.loads(msg_raw) if isinstance(msg_raw, str) else msg_raw
            job_id = msg.get("JobId")
            if not job_id:
                raise ValueError("SNS message missing JobId")
            return job_id, msg.get("DocumentLocation"), msg.get("JobTag")
    # Direct/test
    if "JobId" in event:
        return event["JobId"], event.get("DocumentLocation"), event.get("JobTag")
    raise ValueError("No JobId found in event")

def _resolve_source_keys(doc_loc: Optional[dict], job_tag: Optional[str]) -> Tuple[str, str]:
    src_bucket = None
    src_key = None
    if isinstance(doc_loc, dict):
        src_bucket = doc_loc.get("S3Bucket")     or doc_loc.get("Bucket")
        src_key    = doc_loc.get("S3ObjectName") or doc_loc.get("Name")
    if (not src_bucket or not src_key) and job_tag:
        try:
            tag = json.loads(job_tag)
            src_bucket = src_bucket or tag.get("bucket")
            src_key    = src_key    or tag.get("key")
        except Exception:
            pass
    return src_bucket or OUTPUT_BUCKET, src_key or "incoming/unknown.pdf"

# ---------- CSV + QBO ----------
_DATE_PATTERNS = [
    "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d-%b-%Y", "%d-%b-%y", "%Y/%m/%d",
    "%d/%m/%Y", "%d/%m/%y"
]

def _parse_date(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    # try straight formats
    for fmt in _DATE_PATTERNS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    # try compact 8-digit yyyymmdd
    m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None

def _parse_amount(s: str) -> Optional[float]:
    if s is None:
        return None
    txt = str(s).strip()
    if not txt:
        return None
    # handle parentheses negatives and currency symbols/commas
    neg = False
    if txt.startswith("(") and txt.endswith(")"):
        neg = True
        txt = txt[1:-1]
    txt = txt.replace("$","").replace(",","").replace("USD","").strip()
    # some tables might encode debit/credit as separate cols; this will still parse the numeric cell
    try:
        val = float(txt)
        return -val if neg else val
    except ValueError:
        return None

def _detect_header_indices(grid: List[List[str]]) -> Optional[Dict[str,int]]:
    """
    Best-effort header detection within first 5 rows.
    Returns a mapping like {'date': i, 'desc': j, 'amount': k} if found.
    Also supports debit/credit columns to synthesize amount.
    """
    max_scan = min(len(grid), 5)
    for r in range(max_scan):
        row = [ (c or "").strip() for c in grid[r] ]
        lower = [ c.lower() for c in row ]
        idx = {}
        # date column
        for i, c in enumerate(lower):
            if "date" in c:
                idx['date'] = i; break
        # amount OR debit/credit
        amt_i = None
        for i, c in enumerate(lower):
            if any(tok in c for tok in ("amount","amt")):
                amt_i = i; break
        debit_i = credit_i = None
        if amt_i is None:
            for i, c in enumerate(lower):
                if "debit" in c: debit_i = i
                if "credit" in c: credit_i = i
        # description/payee/memo
        desc_i = None
        for i, c in enumerate(lower):
            if any(tok in c for tok in ("description","desc","payee","memo","name","details")):
                desc_i = i; break

        if 'date' in idx and (amt_i is not None or debit_i is not None or credit_i is not None) and desc_i is not None:
            idx['desc'] = desc_i
            if amt_i is not None:
                idx['amount'] = amt_i
            else:
                if debit_i is not None: idx['debit'] = debit_i
                if credit_i is not None: idx['credit'] = credit_i
            # assume next row is data start; caller should skip header row
            return idx
    return None

def _rows_to_transactions(grid: List[List[str]]) -> List[Dict[str,Any]]:
    """
    Convert a table grid to transaction dicts.
    Returns list of {date: datetime, desc: str, amount: float}
    """
    txns = []
    if not grid:
        return txns

    indices = _detect_header_indices(grid)
    start_row = 1 if indices else 0  # if we found a header, treat row 0 as header

    for r in range(start_row, len(grid)):
        row = grid[r]
        # skip empty-ish rows
        if not any(cell.strip() for cell in row if isinstance(cell, str)):
            continue

        # try parse by indices
        date_val = desc_val = amt_val = None
        if indices:
            d_idx = indices.get('date')
            desc_idx = indices.get('desc')
            a_idx = indices.get('amount')
            deb_i = indices.get('debit')
            cre_i = indices.get('credit')

            d_txt = row[d_idx] if d_idx is not None and d_idx < len(row) else ""
            date_val = _parse_date(d_txt)

            desc_val = (row[desc_idx] if desc_idx is not None and desc_idx < len(row) else "").strip()

            if a_idx is not None and a_idx < len(row):
                amt_val = _parse_amount(row[a_idx])
            else:
                debit_val = _parse_amount(row[deb_i]) if deb_i is not None and deb_i < len(row) else None
                credit_val = _parse_amount(row[cre_i]) if cre_i is not None and cre_i < len(row) else None
                if debit_val is not None:
                    amt_val = -abs(debit_val)
                elif credit_val is not None:
                    amt_val = abs(credit_val)
        else:
            # heuristic: try first 3 cols as date, desc, amount
            if len(grid[r]) >= 3:
                date_val = _parse_date(grid[r][0])
                desc_val = (grid[r][1] or "").strip()
                amt_val  = _parse_amount(grid[r][2])

        # require minimally date + amount (desc may be empty)
        if date_val and (amt_val is not None):
            txns.append({
                "date": date_val,
                "desc": (desc_val or "")[:32],
                "amount": float(amt_val)
            })
    return txns

def _make_fitid(d: datetime, desc: str, amt: float) -> str:
    # 12-hex unique id from simple hash
    h = hashlib.md5(f"{d:%Y%m%d}{amt:.2f}{desc}".encode("utf-8")).hexdigest()
    return h[:12]

def _build_qbo(transactions):
    """
    Build a QBO (OFX 1.02) acceptable to QuickBooks Desktop.
    Adds TRNUID and ledger balances; uses generic FI (ORG=BANK, FID=3000) by default.
    """
    fi_org = FI_ORG or "BANK"
    fi_fid = FI_FID or "3000"
    intu_bid = INTU_BID or "2430"
    bankid = BANK_ID
    acctid = ACCT_ID
    accttype = ACCT_TYPE

    def _crlf_join(lines):
        return "\r\n".join(lines) + "\r\n"

    header = _crlf_join([
        "OFXHEADER:100",
        "DATA:OFXSGML",
        "VERSION:102",
        "SECURITY:NONE",
        "ENCODING:USASCII",
        "CHARSET:1252",
        "COMPRESSION:NONE",
        "OLDFILEUID:NONE",
        "NEWFILEUID:NONE",
        ""  # blank line before <OFX>
    ])

    now = datetime.utcnow()
    dtserver = now.strftime("%Y%m%d%H%M%S")
    trnuid = uuid.uuid4().hex[:16]  # TRNUID must be present; any unique string

    # Dates for BANKTRANLIST
    if transactions:
        dates = sorted(t["date"] for t in transactions)
        dtstart = dates[0].strftime("%Y%m%d")
        dtend   = dates[-1].strftime("%Y%m%d")
    else:
        dtstart = now.strftime("%Y%m%d")
        dtend   = now.strftime("%Y%m%d")

    # Compute a simple ending balance (sum of amounts); if you have a real starting balance, use it.
    ending_balance = sum(t["amount"] for t in transactions) if transactions else 0.0
    dtasof = dtend + "120000"  # include time for balance timestamps

    lines = []
    lines.append("<OFX>")
    # Sign-on
    lines += [
        "<SIGNONMSGSRSV1><SONRS>",
        "<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>",
        f"<DTSERVER>{dtserver}</DTSERVER>",
        "<LANGUAGE>ENG</LANGUAGE>",
        f"<FI><ORG>{fi_org}</ORG><FID>{fi_fid}</FID></FI>",
        f"<INTU.BID>{intu_bid}</INTU.BID>",
        "</SONRS></SIGNONMSGSRSV1>"
    ]
    # Banking message with TRNUID
    lines += [
        "<BANKMSGSRSV1><STMTTRNRS>",
        f"<TRNUID>{trnuid}</TRNUID>",
        "<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>",
        "<STMTRS>",
        "<CURDEF>USD</CURDEF>",
        f"<BANKACCTFROM><BANKID>{bankid}</BANKID><ACCTID>{acctid}</ACCTID><ACCTTYPE>{accttype}</ACCTTYPE></BANKACCTFROM>",
        f"<BANKTRANLIST><DTSTART>{dtstart}</DTSTART><DTEND>{dtend}</DTEND>"
    ]

    # Transactions
    for t in transactions:
        trntype = "CREDIT" if t["amount"] > 0 else "DEBIT"
        dt = t["date"].strftime("%Y%m%d")
        amt = f"{t['amount']:.2f}"
        name = (t.get("desc") or "")[:32]
        fitid = _make_fitid(t["date"], name, t["amount"])
        lines += [
            "<STMTTRN>",
            f"<TRNTYPE>{trntype}</TRNTYPE>",
            f"<DTPOSTED>{dt}</DTPOSTED>",
            f"<TRNAMT>{amt}</TRNAMT>",
            f"<FITID>{fitid}</FITID>",
            f"<NAME>{name}</NAME>",
            "</STMTTRN>"
        ]

    # Close list + add balances
    lines += [
        "</BANKTRANLIST>",
        f"<LEDGERBAL><BALAMT>{ending_balance:.2f}</BALAMT><DTASOF>{dtasof}</DTASOF></LEDGERBAL>",
        f"<AVAILBAL><BALAMT>{ending_balance:.2f}</BALAMT><DTASOF>{dtasof}</DTASOF></AVAILBAL>",
        "</STMTRS></STMTTRNRS></BANKMSGSRSV1>",
    ]
    lines.append("</OFX>")

    return header + _crlf_join(lines)

# ---------- Lambda handler ----------
def lambda_handler(event, _):
    # 1) Parse event
    job_id, doc_loc, job_tag = _extract_job_from_event(event)
    print({"parsed": {"job_id": job_id, "doc_loc": doc_loc, "job_tag": job_tag}})

    # 2) Get all blocks
    all_blocks = []
    for page in _iter_pages(job_id):
        all_blocks.extend(page.get("Blocks", []))

    # 3) CSV build
    out_csv = io.StringIO()
    w = csv.writer(out_csv)
    table_count = 0
    all_transactions: List[Dict[str,Any]] = []

    for t, grid in _tables_from_blocks(all_blocks):
        table_count += 1
        # Write CSV section
        w.writerow([f"#TABLE {table_count} (Page {t.get('Page', '?')})"])
        for row in grid:
            w.writerow(row)
        w.writerow([])

        # Try extracting transactions from this grid
        txns = _rows_to_transactions(grid)
        if txns:
            all_transactions.extend(txns)

    if table_count == 0:
        w.writerow(["#NO_TABLES_FOUND"])

    csv_bytes = out_csv.getvalue().encode("utf-8-sig")

    # 4) Decide base names
    src_bucket, src_key = _resolve_source_keys(doc_loc, job_tag)
    base = os.path.basename(src_key).rsplit(".", 1)[0] or "document"
    csv_key = f"{OUTPUT_PREFIX}{base}.tables.csv"
    qbo_key = f"{OUTPUT_PREFIX}{base}.qbo"

    # 5) Write CSV
    s3.put_object(Bucket=OUTPUT_BUCKET, Key=csv_key, Body=csv_bytes, ContentType="text/csv")
    print(f"Wrote CSV s3://{OUTPUT_BUCKET}/{csv_key}")

    # 6) Build + write QBO
    try:
        qbo_text = _build_qbo(all_transactions)
        s3.put_object(
            Bucket=OUTPUT_BUCKET,
            Key=qbo_key,
            Body=qbo_text.encode("utf-8"),
            ContentType="application/vnd.intu.qbo"  # or text/plain
        )
        print(f"Wrote QBO s3://{OUTPUT_BUCKET}/{qbo_key} (txns={len(all_transactions)})")
    except Exception as e:
        print({"qbo_build_error": str(e)})

    return {
        "ok": True,
        "csv": f"s3://{OUTPUT_BUCKET}/{csv_key}",
        "qbo": f"s3://{OUTPUT_BUCKET}/{qbo_key}",
        "tables": table_count,
        "transactions": len(all_transactions),
    }
