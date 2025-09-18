# Bonz.ai App

Hotel booking API built using the Serverless Framework (AWS Lambda, API Gateway, and DynamoDB).

👥 Built by Ruby Knights

# Setup & Installation

Steps to set up and deploy the project.

## 1. Clone the repository

```bash
git clone https://github.com/kelsaur/Bonz.ai
cd Bonz.ai
```

## 2. Install dependencies

```bash
npm install
```

## 3. Install Serverless Framework

```bash
npm install -g serverless
```

## 4. Deploy to AWS

```bash
serverless deploy
```

# Endpoints

The endpoints are RESTful and hosted using AWS API Gateway (HTTP APIs).

| Method | Path                  | Description                       |
| ------ | --------------------- | --------------------------------- |
| POST   | /bookings             | Create a booking (guest)          |
| GET    | /bookings/{bookingId} | Fetch a booking (guest)           |
| GET    | /bookings             | Fetch all bookings (receptionist) |
| PUT    | /bookings/{bookingId} | Update a booking (guest)          |
| DELETE | /bookings/{bookingId} | Delete a booking (guest)          |

### Example Request: Create Booking (`POST /bookings`)

```
Content-Type: application/json

{
  "guestName": "Ada Lovelace",
  "guestEmail": "adalovelace@email.com",
  "guestCount": 3,
  "checkIn": "2025-10-01",
  "checkOut": "2025-10-04",
  "roomTypes": [
    {
      "type": "enkel",
      "rooms": 1,
      "guests": 1
    },
    {
      "type": "dubbel",
      "rooms": 1,
      "guests": 2
    }
  ]
}
```

### Example Request: Update Booking (`PUT /bookings/{bookingId}`)

```
Content-Type: application/json

{
  "guestCount": 4,
  "checkIn": "2025-10-02",
  "checkOut": "2025-10-05",
  "roomTypes": [
    {
      "type": "dubbel",
      "rooms": 1,
      "guests": 2
    },
    {
      "type": "dubbel",
      "rooms": 1,
      "guests": 2
    }
  ]
}
```
