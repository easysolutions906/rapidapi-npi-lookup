import express from 'express';

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());

const buildNppesUrl = (params) => {
  const searchParams = new URLSearchParams({ version: '2.1' });
  Object.entries(params).forEach(([key, val]) => {
    if (val) searchParams.set(key, val);
  });
  return `https://npiregistry.cms.hhs.gov/api/?${searchParams.toString()}`;
};

const formatProvider = (result) => {
  const basic = result.basic || {};
  const addresses = (result.addresses || []).map((addr) => ({
    type: addr.address_purpose === 'LOCATION' ? 'practice' : 'mailing',
    line1: addr.address_1,
    line2: addr.address_2 || null,
    city: addr.city,
    state: addr.state,
    zip: addr.postal_code,
    country: addr.country_code,
    phone: addr.telephone_number,
    fax: addr.fax_number || null,
  }));

  const taxonomies = (result.taxonomies || []).map((tax) => ({
    code: tax.code,
    description: tax.desc,
    primary: tax.primary,
    state: tax.state,
    license: tax.license,
  }));

  const identifiers = (result.identifiers || []).map((id) => ({
    code: id.code,
    description: id.desc,
    identifier: id.identifier,
    state: id.state,
    issuer: id.issuer,
  }));

  const isOrganization = result.enumeration_type === 'NPI-2';

  return {
    npi: result.number,
    type: isOrganization ? 'organization' : 'individual',
    ...(isOrganization ? {
      organizationName: basic.organization_name,
      authorizedOfficial: basic.authorized_official_first_name
        ? `${basic.authorized_official_first_name} ${basic.authorized_official_last_name}`
        : null,
    } : {
      firstName: basic.first_name,
      lastName: basic.last_name,
      middleName: basic.middle_name || null,
      credential: basic.credential || null,
      gender: basic.gender || null,
    }),
    status: basic.status || 'Active',
    enumerationDate: basic.enumeration_date,
    lastUpdated: basic.last_updated,
    addresses,
    taxonomies,
    identifiers,
  };
};

const searchNppes = async (params) => {
  const url = buildNppesUrl(params);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'NPI-Lookup-API/1.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NPPES API error (${res.status}): ${body.substring(0, 200)}`);
  }
  const data = await res.json();

  if (data.Errors) {
    throw new Error(data.Errors.map((e) => e.description).join('; '));
  }

  return {
    count: data.result_count || 0,
    results: (data.results || []).map(formatProvider),
  };
};

app.get('/', (_req, res) => {
  res.json({
    name: 'NPI Provider Lookup API',
    version: '1.0.0',
    description: 'Search the NPPES NPI Registry for healthcare providers',
    endpoints: {
      'GET /search?last_name=Smith&state=CA': 'Search providers by name, location, specialty',
      'GET /npi/:number': 'Look up a provider by NPI number',
      'POST /npi/batch': 'Look up multiple NPI numbers (body: { npis: [...] }, max 25)',
      'GET /health': 'Health check',
    },
    searchParams: {
      number: 'NPI number',
      first_name: 'Provider first name',
      last_name: 'Provider last name',
      organization_name: 'Organization name',
      taxonomy_description: 'Specialty/taxonomy (e.g., "Cardiology")',
      city: 'City',
      state: 'State code (e.g., CA, NY)',
      postal_code: 'ZIP code',
      limit: 'Results per page (default 10, max 200)',
      skip: 'Number of results to skip (for pagination)',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/search', async (req, res) => {
  const { first_name, last_name, organization_name, taxonomy_description, city, state, postal_code, limit = '10', skip = '0' } = req.query;

  if (!first_name && !last_name && !organization_name && !taxonomy_description && !city && !state && !postal_code) {
    return res.status(400).json({ error: 'At least one search parameter is required' });
  }

  try {
    const result = await searchNppes({
      first_name, last_name, organization_name, taxonomy_description,
      city, state, postal_code,
      limit: String(Math.min(parseInt(limit, 10) || 10, 200)),
      skip,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

app.get('/npi/:number', async (req, res) => {
  const { number } = req.params;
  if (!/^\d{10}$/.test(number)) {
    return res.status(400).json({ error: 'NPI must be a 10-digit number' });
  }
  try {
    const result = await searchNppes({ number });
    if (result.count === 0) {
      return res.status(404).json({ error: 'NPI not found' });
    }
    res.json(result.results[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

app.post('/npi/batch', async (req, res) => {
  const { npis } = req.body;
  if (!npis || !Array.isArray(npis)) {
    return res.status(400).json({ error: 'Request body must contain an "npis" array' });
  }
  if (npis.length > 25) {
    return res.status(400).json({ error: 'Maximum 25 NPIs per batch request' });
  }
  try {
    const results = await Promise.allSettled(
      npis.map((npi) => searchNppes({ number: String(npi) }).then((r) => r.results[0] || { npi, error: 'Not found' }))
    );
    const formatted = results.map((r, i) => r.status === 'fulfilled' ? r.value : { npi: npis[i], error: r.reason?.message });
    res.json({ total: formatted.length, results: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Batch lookup failed', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NPI Provider Lookup API running on port ${PORT}`);
});
