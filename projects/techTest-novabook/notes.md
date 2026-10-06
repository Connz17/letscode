Endpoint Specs

Ingest Endpoint

Allows a user to send sales and tax payment events to our service

Method: POST
Request path: /transactions
Request JSON Body: One of the following

Sale Event
{
	“eventType”: “SALES”,
	“date”: string - Date and time ISO 8601
“invoiceId”: string,
“items”: [{
 		“itemId”: string,
 		“cost”: number - amount in pennies,
 		“taxRate”: number
}]
}

Sale Event Example
{
	“eventType”: “SALES”,
	“date”: “2024-02-22T17:29:39Z”,
“invoiceId”: “3419027d-960f-4e8f-b8b7-f7b2b4791824”,
  	“items”: [{
	“itemId”: “02db47b6-fe68-4005-a827-24c6e962f3df”,
	“cost”: 1099, // This is £10.99
“taxRate”: 0.2
}]
}

Tax Payment Event
{
	“eventType”: “TAX_PAYMENT”,
	“date”: string - Date and time ISO 8601,
	“amount”: number - amount in pennies
}


Tax Payment Event Example
{
	“eventType”: “TAX_PAYMENT”,
	“date”: “2024-02-22T17:29:39Z”,
	“amount”: 74901 // £749.01
}

Successful response
Status code: 202
No body


Query Tax Position Endpoint

Allows a user to query their tax position at any given point in time. This should calculate the tax position from ingested events and any further user interaction

Method: GET
Request path: /tax-position
Request query parameters:
date: Date and time ISO 8601
Mandatory
Example: 2024-02-22T17:29:39Z
No Request body


Successful response
Status code: 200
Response JSON body: 
{
  “date”: Date and time ISO 8601
  “taxPosition”: number
}

Example body:
{
  “date”: “2024-02-22T17:29:39Z”,
  “taxPosition”: 49 // £0.49
}


Amend Sale Endpoint

Allows a user to modify an item within a sale at a specific point in time. The service must accept all amendments even if the sale or item does not yet exist. The sales event can be received by the service after the amendment.

Method: PATCH
Request path: /sale
Request JSON Body 
{
	“date”: Date and time ISO 8601,
“invoiceId”: string,
“itemId”: string,
	“cost”: number - amount in pennies,
 	“taxRate”: number
}
Request JSON Example
{
“date”: “2024-02-22T17:29:39Z”,
“invoiceId”: “3419027d-960f-4e8f-b8b7-f7b2b4791824”,
“itemId”: “02db47b6-fe68-4005-a827-24c6e962f3df”,
	“cost”: 798 // £7.98,
 	“taxRate”: 0.15
}


Successful response
Status code: 202
No body

---
Different HTTP Methods:
- POST
- GET
- PUT
- DELETE
- PATCH

Language: Typescript via HTTP endpoints
1. Ingest - (User sends data via POST)
	1. All Sales events 
	2. Tax Payment Events
		1. tax = cost * tax rate

Ingest Processing:
- This should write to the taxPayment tale or the items table


2. Query (GET)
	1. Tax Position (At a given time - Up to and Inclusive of date and time)
		1. Total Tax from Sales - Tax Payments Made 
Query Processing:
 - Group By (Item&Inovice)
Pick Latest
sales_events = Sum(Rate * Cost) 

payment_made = SELECT SUM(amount) FROM tax_payments WHERE date < (D1) Date from query

return sales_events - payment_made


4. Amend (PATCH - used to update)
Amend Processing:
	add to the items table

6. Observability - not functionality
	1. ReadMe - how to start the services along with another tasks
	2. Logging - What do want to log
		1. Errors
		2. Status Codes
		3. Problem Details - A standard of surfacing errors to a consuming


---

Tax Payments Table

| date | amount |
| ---- | ------ |
| D0   | 100    |


Items Table

| ItemId | InoviceId (FK) | Cost | Rate | Date | COMMENT    |
| ------ | -------------- | ---- | ---- | ---- | ---------- |
| Item1  | Inv1           | 100  | 0.15 | D0   | Initial    |
| Item2  | Inv1           | 150  | 0.15 | D0   | Initial    |
| Item1  | Inv1           | 110  | 0.15 | D1   | Ammendment |
| Item1  | Inv2           | 100  | 0.15 | D2   | Initial    |
| Item1  | Inv3           | 100  | 0.15 | D3   | Initial    |
| Item3  | Inv3           | 150  | 0.15 | D3   | Initial    |

GET (date: D1):
Fetch all items <= Date from query (D1)

| ItemId    | InoviceId (FK) | Cost    | Rate     | Date   | COMMENT     |
| --------- | -------------- | ------- | -------- | ------ | ----------- |
| ~Item1~ | ~Inv1~       | ~100~ | ~0.15~ | ~D0~ | ~Initial~ |
| Item2     | Inv1           | 150     | 0.15     | D0     | Initial     |
| Item1     | Inv1           | 110     | 0.15     | D1     | Ammendment  |
