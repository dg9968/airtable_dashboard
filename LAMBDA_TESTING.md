# Lambda Function Testing Guide

## Testing Credit Card vs Bank Statement QBO Generation

The updated Lambda function now supports both bank accounts and credit card statements with different QBO formats.

### How to Test

1. **Upload a file via the web interface**
   - Go to `/bank-statement-processing`
   - Select account type: "Credit Card" or "Bank Account"
   - Enter account number (optional, e.g., "941004")
   - Upload your statement file

2. **Check CloudWatch Logs**
   The Lambda function will log:
   ```
   Retrieved metadata from s3://bucket/key: {metadata dict}
   Processing with account_type=credit-card, account_number=941004
   DEBUG: Checking account_type value: 'credit-card' (type: str)
   DEBUG: Comparison result: account_type == 'credit-card' -> True
   Using CREDIT CARD QBO format
   Built credit card QBO with X transactions
   ```

3. **Verify QBO Format**
   Download the QBO file and check the structure:

   **Credit Card Format:**
   ```xml
   <CREDITCARDMSGSRSV1>
     <CCSTMTTRNRS>
       <CCSTMTRS>
         <CCACCTFROM>
           <ACCTID>941004</ACCTID>
         </CCACCTFROM>
   ```

   **Bank Format:**
   ```xml
   <BANKMSGSRSV1>
     <STMTTRNRS>
       <STMTRS>
         <BANKACCTFROM>
           <BANKID>123456</BANKID>
           <ACCTID>000000000</ACCTID>
           <ACCTTYPE>CHECKING</ACCTTYPE>
         </BANKACCTFROM>
   ```

### Troubleshooting

**Issue: Always generates bank format, never credit card**

Check the logs for:
1. Metadata retrieval - does it show `accounttype: credit-card`?
2. Account type comparison - does the DEBUG line show `True`?

**Common Causes:**
- S3 metadata keys are stored as camelCase but read as lowercase
- Frontend not sending `accountType` correctly
- Lambda not reading from correct S3 key

**Fix:**
The backend stores metadata with these keys:
- `accountType` → S3 converts to `accounttype`
- `accountNumber` → S3 converts to `accountnumber`

Lambda reads them as lowercase:
```python
account_type = metadata.get('accounttype', 'bank')
account_number = metadata.get('accountnumber', '')
```

### Manual Lambda Test Event

You can test the Lambda directly with this event:
```json
{
  "JobId": "your-textract-job-id",
  "DocumentLocation": {
    "S3Bucket": "your-bucket",
    "S3ObjectName": "incoming/1234567890_abc123.pdf"
  }
}
```

Make sure the S3 object has metadata:
```bash
aws s3api head-object \
  --bucket your-bucket \
  --key incoming/1234567890_abc123.pdf
```

Expected output should include:
```json
"Metadata": {
  "accounttype": "credit-card",
  "accountnumber": "941004"
}
```

## Deployment

To deploy the updated Lambda:
```bash
cd /path/to/lambda
zip lambda.zip lambda_function.py
aws lambda update-function-code \
  --function-name YourFunctionName \
  --zip-file fileb://lambda.zip
```
