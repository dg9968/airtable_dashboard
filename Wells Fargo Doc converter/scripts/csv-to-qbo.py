#!/usr/bin/env python3
"""
Convert table-3.csv to QBO format using lambda_function.py logic
"""
import csv
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

# Configuration (matching bank_statement_01_2024.qbo)
BANK_ID = "072000326"
ACCT_ID = "891536836"
ACCT_TYPE = "CHECKING"
FI_ORG = "B1"
FI_FID = "10898"
INTU_BID = "2430"

def _parse_date(s: str) -> Optional[datetime]:
    """Parse date from various formats, handling month/day format like '1/2'"""
    s = (s or "").strip().strip("'")
    if not s:
        return None

    # Handle month/day format (assume 2024)
    if "/" in s and len(s.split("/")) == 2:
        try:
            month, day = s.split("/")
            return datetime(2024, int(month), int(day))
        except ValueError:
            pass

    # Try standard formats
    formats = [
        "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d-%b-%Y", "%d-%b-%y", "%Y/%m/%d",
        "%d/%m/%Y", "%d/%m/%y"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass

    return None

def _parse_amount(s: str) -> Optional[float]:
    """Parse amount, handling commas and Spanish/English formats"""
    if s is None:
        return None
    txt = str(s).strip().strip("'")
    if not txt:
        return None

    # Handle parentheses negatives
    neg = False
    if txt.startswith("(") and txt.endswith(")"):
        neg = True
        txt = txt[1:-1]

    # Remove currency symbols and commas
    txt = txt.replace("$", "").replace(",", "").replace("USD", "").strip()

    try:
        val = float(txt)
        return -val if neg else val
    except ValueError:
        return None

def _make_fitid(d: datetime, desc: str, amt: float) -> str:
    """Generate unique transaction ID"""
    h = hashlib.md5(f"{d:%Y%m%d}{amt:.2f}{desc}".encode("utf-8")).hexdigest()
    return h[:12]

def _build_qbo(transactions: List[Dict[str, Any]]) -> str:
    """Build QBO file matching bank_statement_01_2024.qbo structure"""
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
        ""
    ])

    now = datetime.utcnow()
    dtserver = now.strftime("%Y%m%d%H%M%S")
    trnuid = uuid.uuid4().hex[:16]

    # Date range
    if transactions:
        dates = sorted(t["date"] for t in transactions)
        dtstart = dates[0].strftime("%Y%m%d")
        dtend = dates[-1].strftime("%Y%m%d")
    else:
        dtstart = now.strftime("%Y%m%d")
        dtend = now.strftime("%Y%m%d")

    # Calculate ending balance
    ending_balance = sum(t["amount"] for t in transactions) if transactions else 0.0
    dtasof = dtend + "120000"

    lines = []
    lines.append("<OFX>")

    # Sign-on message
    lines += [
        "<SIGNONMSGSRSV1><SONRS>",
        "<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>",
        f"<DTSERVER>{dtserver}</DTSERVER>",
        "<LANGUAGE>ENG</LANGUAGE>",
        f"<FI><ORG>{FI_ORG}</ORG><FID>{FI_FID}</FID></FI>",
        f"<INTU.BID>{INTU_BID}</INTU.BID>",
        "</SONRS></SIGNONMSGSRSV1>"
    ]

    # Banking message
    lines += [
        "<BANKMSGSRSV1><STMTTRNRS>",
        f"<TRNUID>{trnuid}</TRNUID>",
        "<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>",
        "<STMTRS>",
        "<CURDEF>USD</CURDEF>",
        f"<BANKACCTFROM><BANKID>{BANK_ID}</BANKID><ACCTID>{ACCT_ID}</ACCTID><ACCTTYPE>{ACCT_TYPE}</ACCTTYPE></BANKACCTFROM>",
        f"<BANKTRANLIST><DTSTART>{dtstart}</DTSTART><DTEND>{dtend}</DTEND>"
    ]

    # Transactions
    for t in transactions:
        trntype = "CREDIT" if t["amount"] > 0 else "DEBIT"
        dt = t["date"].strftime("%Y%m%d")
        amt = f"{t['amount']:.2f}"
        name = (t.get("desc") or "")[:30]  # Maximum 30 characters
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

    # Close and add balances
    lines += [
        "</BANKTRANLIST>",
        f"<LEDGERBAL><BALAMT>{ending_balance:.2f}</BALAMT><DTASOF>{dtasof}</DTASOF></LEDGERBAL>",
        f"<AVAILBAL><BALAMT>{ending_balance:.2f}</BALAMT><DTASOF>{dtasof}</DTASOF></AVAILBAL>",
        "</STMTRS></STMTTRNRS></BANKMSGSRSV1>",
    ]
    lines.append("</OFX>")

    return header + _crlf_join(lines)

def convert_csv_to_qbo(csv_path: str, qbo_path: str):
    """Convert table-3.csv to QBO format"""
    transactions = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)

        for row in reader:
            if len(row) < 6:
                continue

            # Skip header and empty rows
            if not row[0] or row[0].startswith("'Fecha") or row[0].startswith("'Confidence"):
                continue

            date_str = row[0]
            check_num = row[1]
            desc = row[2]
            credit = row[3]  # Depósitos/Créditos
            debit = row[4]   # Retiros/Débitos
            balance = row[5]

            # Parse date
            date_val = _parse_date(date_str)
            if not date_val:
                continue

            # Parse amount (credit is positive, debit is negative)
            amount = None
            if credit:
                credit_val = _parse_amount(credit)
                if credit_val is not None:
                    amount = abs(credit_val)

            if debit:
                debit_val = _parse_amount(debit)
                if debit_val is not None:
                    amount = -abs(debit_val)

            if amount is None:
                continue

            # Clean description
            desc_clean = (desc or "").strip().strip("'")
            if not desc_clean:
                continue

            transactions.append({
                "date": date_val,
                "desc": desc_clean,
                "amount": float(amount)
            })

    print(f"Parsed {len(transactions)} transactions")

    # Build QBO
    qbo_content = _build_qbo(transactions)

    # Write QBO file
    with open(qbo_path, 'w', encoding='utf-8') as f:
        f.write(qbo_content)

    print(f"QBO file written to: {qbo_path}")
    print(f"Total transactions: {len(transactions)}")
    if transactions:
        total = sum(t["amount"] for t in transactions)
        print(f"Net balance: ${total:.2f}")

if __name__ == "__main__":
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)

    csv_file = os.path.join(base_dir, "table-3.csv")
    qbo_file = os.path.join(base_dir, "output", "table-3.qbo")

    convert_csv_to_qbo(csv_file, qbo_file)
