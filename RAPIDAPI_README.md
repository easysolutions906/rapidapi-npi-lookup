**Spotlight:** Search the NPPES registry for healthcare providers by name, specialty, or location. Returns addresses, taxonomies, and identifiers for any NPI number.

Search the NPPES NPI Registry for healthcare providers by name, specialty, location, or NPI number. Returns provider details, addresses, taxonomies, and identifiers.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search providers by name, specialty, city, state |
| GET | `/npi/:number` | Look up a provider by 10-digit NPI number |
| POST | `/npi/batch` | Look up multiple NPI numbers at once (max 25) |

### Quick Start

```javascript
const response = await fetch('https://npi-provider-lookup.p.rapidapi.com/search?last_name=Smith&state=CA&taxonomy_description=Cardiology', {
  headers: {
    'x-rapidapi-key': 'YOUR_API_KEY',
    'x-rapidapi-host': 'npi-provider-lookup.p.rapidapi.com'
  }
});
const data = await response.json();
// { count: 10, results: [{ npi: "1234567890", type: "individual", firstName: "John", lastName: "Smith", ... }] }
```

### Rate Limits

| Plan | Requests/month | Rate |
|------|---------------|------|
| Basic (Pay Per Use) | Unlimited | 10/min |
| Pro ($9.99/mo) | 5,000 | 50/min |
| Ultra ($29.99/mo) | 25,000 | 200/min |
| Mega ($99.99/mo) | 100,000 | 500/min |
