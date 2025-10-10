const fs = require('fs');
const path = require('path');

/**
 * Wells Fargo CSV Parser and QuickBooks IIF Converter
 *
 * Parses Wells Fargo bank statements from CSV and converts to QuickBooks Desktop IIF format
 */

class WellsFargoProcessor {
  constructor(inputFolder, outputFolder) {
    this.inputFolder = inputFolder;
    this.outputFolder = outputFolder;
    this.transactions = [];
  }

  /**
   * Parse a single CSV file
   */
  parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("'Confidence")) break;

      // Parse CSV line (handle quoted fields with commas)
      const matches = line.match(/"'([^"]*)"/g);
      if (!matches || matches.length < 6) continue;

      const fields = matches.map(m => m.replace(/"'/g, '').replace(/"/g, '').trim());

      const [date, checkNum, description, deposits, withdrawals, balance] = fields;

      // Skip empty rows or confidence score rows
      if (!date || date.includes('Confidence') || date.includes('Fecha')) continue;

      transactions.push({
        date,
        checkNumber: checkNum,
        description,
        deposit: deposits ? this.parseAmount(deposits) : 0,
        withdrawal: withdrawals ? this.parseAmount(withdrawals) : 0,
        balance: balance ? this.parseAmount(balance) : 0
      });
    }

    return transactions;
  }

  /**
   * Parse amount string to number
   */
  parseAmount(amountStr) {
    if (!amountStr) return 0;
    // Remove currency symbols, commas, and convert to number
    return parseFloat(amountStr.replace(/[$,]/g, '').trim()) || 0;
  }

  /**
   * Convert date from M/D format to MM/DD/YYYY
   * Assumes current year or previous year based on month
   */
  formatDate(dateStr, year = 2024) {
    if (!dateStr) return '';
    const [month, day] = dateStr.split('/').map(n => n.padStart(2, '0'));
    return `${month}/${day}/${year}`;
  }

  /**
   * Convert date to OFX format (YYYYMMDD)
   */
  formatDateOFX(dateStr, year = 2024) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length < 2) return '';
    const month = (parts[0] || '1').padStart(2, '0');
    const day = (parts[1] || '1').padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Consolidate all CSV files
   */
  consolidateCSVs() {
    const csvFiles = fs.readdirSync(this.inputFolder)
      .filter(file => file.startsWith('table-') && file.endsWith('.csv'))
      .filter(file => {
        // Only process transaction tables (3-7 based on preview)
        const num = parseInt(file.match(/table-(\d+)/)?.[1]);
        return num >= 3 && num <= 7;
      })
      .sort();

    console.log(`Found ${csvFiles.length} transaction files to process`);

    csvFiles.forEach(file => {
      const filePath = path.join(this.inputFolder, file);
      console.log(`Processing ${file}...`);
      const trans = this.parseCSV(filePath);
      this.transactions.push(...trans);
      console.log(`  - Extracted ${trans.length} transactions`);
    });

    console.log(`\nTotal transactions: ${this.transactions.length}`);
    return this.transactions;
  }

  /**
   * Save consolidated data to JSON
   */
  saveConsolidatedJSON(filename = 'consolidated-transactions.json') {
    const outputPath = path.join(this.outputFolder, filename);
    fs.writeFileSync(outputPath, JSON.stringify(this.transactions, null, 2));
    console.log(`\nSaved consolidated data to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Save consolidated data to CSV
   */
  saveConsolidatedCSV(filename = 'consolidated-transactions.csv') {
    const outputPath = path.join(this.outputFolder, filename);

    // Create CSV header
    let csv = 'Date,Check Number,Description,Deposit,Withdrawal,Balance\n';

    // Add each transaction
    this.transactions.forEach(t => {
      csv += `"${t.date}","${t.checkNumber}","${t.description}",${t.deposit},${t.withdrawal},${t.balance}\n`;
    });

    fs.writeFileSync(outputPath, csv);
    console.log(`Saved consolidated CSV to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Convert to QuickBooks Desktop IIF format
   * IIF format is a tab-delimited format used by QuickBooks Desktop
   */
  convertToQuickBooksIIF(filename = 'quickbooks-import.iif', accountName = 'Wells Fargo Checking') {
    const outputPath = path.join(this.outputFolder, filename);

    let iif = '';

    // IIF Header for Bank transactions
    iif += '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tTOPRINT\tADDR1\tADDR2\tADDR3\tADDR4\tADDR5\n';
    iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tQNTY\tPRICE\tINVITEM\tPAYMETH\tTAXABLE\tREIMBEXP\tEXTRA\n';
    iif += '!ENDTRNS\n';

    // Add each transaction
    this.transactions.forEach((t, index) => {
      const transId = index + 1;
      const date = this.formatDate(t.date);
      const amount = t.deposit > 0 ? t.deposit : -t.withdrawal;
      const memo = t.description.substring(0, 100); // Limit memo length

      // Determine transaction type
      const transType = t.deposit > 0 ? 'DEPOSIT' : 'CHECK';

      // Clean description for payee name
      const payeeName = this.extractPayeeName(t.description);

      // Main transaction line (TRNS)
      iif += `TRNS\t${transId}\t${transType}\t${date}\t${accountName}\t${payeeName}\t\t${amount}\t${t.checkNumber}\t${memo}\tN\tN\t\t\t\t\t\n`;

      // Split line (SPL) - categorized to "Uncategorized" by default
      iif += `SPL\t${transId}\t${transType}\t${date}\tUncategorized\t${payeeName}\t\t${-amount}\t${t.checkNumber}\t${memo}\tN\t\t\t\t\t\t\t\n`;

      // End transaction marker
      iif += `ENDTRNS\n`;
    });

    fs.writeFileSync(outputPath, iif);
    console.log(`\nSaved QuickBooks IIF file to: ${outputPath}`);
    console.log(`\nTo import into QuickBooks Desktop:`);
    console.log(`1. Open QuickBooks Desktop`);
    console.log(`2. Go to File > Utilities > Import > IIF Files`);
    console.log(`3. Select the file: ${filename}`);
    console.log(`4. Review and categorize transactions as needed`);

    return outputPath;
  }

  /**
   * Extract payee name from transaction description
   */
  extractPayeeName(description) {
    // Remove common prefixes
    let name = description
      .replace(/^Purchase authorized on \d+\/\d+ /, '')
      .replace(/^Recurring Payment authorized on \d+\/\d+ /, '')
      .replace(/^Non-WF ATM Withdrawal authorized on \d+\/\d+ /, '')
      .replace(/^ATM Withdrawal authorized on \d+\/\d+ /, '')
      .replace(/^Online Transfer to /, '')
      .replace(/^eDeposit /, '')
      .replace(/^Cash eWithdrawal /, '');

    // Take first part before location or reference numbers
    const parts = name.split(/\s+[A-Z]{2}\s+[SP]\d/);
    name = parts[0].trim();

    // Limit length
    return name.substring(0, 40);
  }

  /**
   * Convert to OFX (Open Financial Exchange) format
   * OFX is compatible with QuickBooks, Quicken, and many other financial software
   */
  convertToOFX(filename = 'wells-fargo-transactions.ofx', accountId = '1234567890', bankId = '121000248') {
    const outputPath = path.join(this.outputFolder, filename);

    // Generate unique transaction IDs
    const generateFITID = (index, date) => {
      return `${date.replace(/\//g, '')}${String(index).padStart(6, '0')}`;
    };

    // Get date range
    const dates = this.transactions.map(t => this.formatDateOFX(t.date));
    const startDate = dates[0] || this.formatDateOFX('1/1');
    const endDate = dates[dates.length - 1] || this.formatDateOFX('1/31');

    // Current timestamp for generation
    const now = new Date();
    const dtserver = now.toISOString().replace(/[-:]/g, '').split('.')[0];

    let ofx = '';

    // OFX Header
    ofx += 'OFXHEADER:100\n';
    ofx += 'DATA:OFXSGML\n';
    ofx += 'VERSION:102\n';
    ofx += 'SECURITY:NONE\n';
    ofx += 'ENCODING:USASCII\n';
    ofx += 'CHARSET:1252\n';
    ofx += 'COMPRESSION:NONE\n';
    ofx += 'OLDFILEUID:NONE\n';
    ofx += 'NEWFILEUID:NONE\n';
    ofx += '\n';

    // OFX Body
    ofx += '<OFX>\n';
    ofx += '<SIGNONMSGSRSV1>\n';
    ofx += '<SONRS>\n';
    ofx += '<STATUS>\n';
    ofx += '<CODE>0\n';
    ofx += '<SEVERITY>INFO\n';
    ofx += '</STATUS>\n';
    ofx += `<DTSERVER>${dtserver}\n`;
    ofx += '<LANGUAGE>ENG\n';
    ofx += '</SONRS>\n';
    ofx += '</SIGNONMSGSRSV1>\n';

    // Bank Statement
    ofx += '<BANKMSGSRSV1>\n';
    ofx += '<STMTTRNRS>\n';
    ofx += '<TRNUID>1\n';
    ofx += '<STATUS>\n';
    ofx += '<CODE>0\n';
    ofx += '<SEVERITY>INFO\n';
    ofx += '</STATUS>\n';
    ofx += '<STMTRS>\n';
    ofx += '<CURDEF>USD\n';
    ofx += '<BANKACCTFROM>\n';
    ofx += `<BANKID>${bankId}\n`;
    ofx += `<ACCTID>${accountId}\n`;
    ofx += '<ACCTTYPE>CHECKING\n';
    ofx += '</BANKACCTFROM>\n';

    // Transaction list
    ofx += '<BANKTRANLIST>\n';
    ofx += `<DTSTART>${startDate}\n`;
    ofx += `<DTEND>${endDate}\n`;

    // Add each transaction
    this.transactions.forEach((t, index) => {
      const amount = t.deposit > 0 ? t.deposit : -t.withdrawal;
      const transType = t.deposit > 0 ? 'CREDIT' : 'DEBIT';
      const date = this.formatDateOFX(t.date);
      const fitid = generateFITID(index, date);
      const payee = this.extractPayeeName(t.description);
      const memo = t.description.substring(0, 255);

      ofx += '<STMTTRN>\n';
      ofx += `<TRNTYPE>${transType}\n`;
      ofx += `<DTPOSTED>${date}\n`;
      ofx += `<TRNAMT>${amount.toFixed(2)}\n`;
      ofx += `<FITID>${fitid}\n`;
      ofx += `<NAME>${this.escapeXML(payee)}\n`;
      if (t.checkNumber) {
        ofx += `<CHECKNUM>${t.checkNumber}\n`;
      }
      ofx += `<MEMO>${this.escapeXML(memo)}\n`;
      ofx += '</STMTTRN>\n';
    });

    ofx += '</BANKTRANLIST>\n';

    // Ledger balance
    const finalBalance = this.transactions[this.transactions.length - 1]?.balance || 0;
    ofx += '<LEDGERBAL>\n';
    ofx += `<BALAMT>${finalBalance.toFixed(2)}\n`;
    ofx += `<DTASOF>${endDate}\n`;
    ofx += '</LEDGERBAL>\n';

    ofx += '</STMTRS>\n';
    ofx += '</STMTTRNRS>\n';
    ofx += '</BANKMSGSRSV1>\n';
    ofx += '</OFX>\n';

    fs.writeFileSync(outputPath, ofx);
    console.log(`\nSaved OFX file to: ${outputPath}`);
    console.log(`\nTo import OFX file:`);
    console.log(`- QuickBooks: File > Utilities > Import > Web Connect Files`);
    console.log(`- Quicken: File > File Import > Web Connect (QFX/OFX)`);
    console.log(`- Most accounting software supports OFX import`);

    return outputPath;
  }

  /**
   * Escape XML special characters
   */
  escapeXML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const totalDeposits = this.transactions.reduce((sum, t) => sum + t.deposit, 0);
    const totalWithdrawals = this.transactions.reduce((sum, t) => sum + t.withdrawal, 0);
    const netChange = totalDeposits - totalWithdrawals;

    console.log('\n=== Transaction Summary ===');
    console.log(`Total Transactions: ${this.transactions.length}`);
    console.log(`Total Deposits: $${totalDeposits.toFixed(2)}`);
    console.log(`Total Withdrawals: $${totalWithdrawals.toFixed(2)}`);
    console.log(`Net Change: $${netChange.toFixed(2)}`);

    return {
      totalTransactions: this.transactions.length,
      totalDeposits,
      totalWithdrawals,
      netChange
    };
  }

  /**
   * Process all files and generate all outputs
   */
  processAll() {
    console.log('=== Wells Fargo Transaction Processor ===\n');

    // Ensure output folder exists
    if (!fs.existsSync(this.outputFolder)) {
      fs.mkdirSync(this.outputFolder, { recursive: true });
    }

    // Consolidate CSVs
    this.consolidateCSVs();

    // Generate outputs
    this.saveConsolidatedJSON();
    this.saveConsolidatedCSV();
    this.convertToQuickBooksIIF();
    this.convertToOFX();

    // Show summary
    this.generateSummary();

    console.log('\n=== Processing Complete ===\n');
  }
}

// Run if called directly
if (require.main === module) {
  const inputFolder = path.join(__dirname, '..', 'Wells Fargo Doc converter');
  const outputFolder = path.join(__dirname, '..', 'Wells Fargo Doc converter', 'output');

  const processor = new WellsFargoProcessor(inputFolder, outputFolder);
  processor.processAll();
}

module.exports = WellsFargoProcessor;
