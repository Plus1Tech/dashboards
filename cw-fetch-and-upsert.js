const SUPABASE_URL  = 'https://pdsvsxzjbkcvychbzqit.supabase.co';
const SUPABASE_KEY  = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const CW_BASE_URL   = 'https://na.myconnectwise.net/v4_6_release/apis/3.0';
const CW_AUTH       = 'YOUR_CW_BASIC_AUTH_BASE64'; // base64(CompanyId+PublicKey:PrivateKey)
const CW_CLIENT_ID  = 'YOUR_CW_CLIENT_ID';

// Maps board name → ticketType value
const BOARD_MAP = {
  'Service Ticket': 'service',
  'New Equipment':  'new_equipment'
};

const PAGE_SIZE = 1000;
let page = 1;
let totalUpserted = 0;

while (true) {
  const tickets = await this.helpers.httpRequest({
    method: 'GET',
    url: `${CW_BASE_URL}/service/tickets`,
    headers: {
      'Authorization': `Basic ${CW_AUTH}`,
      'clientId':      CW_CLIENT_ID,
      'Accept':        'application/json'
    },
    qs: {
      conditions: '(board/name="Service Ticket" OR board/name="New Equipment") AND closedFlag=false',
      fields:     'id,summary,status/name,priority/name,board/name,owner/id,owner/name',
      pageSize:   PAGE_SIZE,
      page
    }
  });

  const batch = Array.isArray(tickets) ? tickets : [];
  if (batch.length === 0) break;

  const rows = batch.map(t => ({
    id:          t.id,
    summary:     t.summary    || '',
    status:      t.status?.name   || 'Unknown',
    priority:    t.priority?.name || 'Unknown',
    board:       t.board?.name    || '',
    ticket_type: BOARD_MAP[t.board?.name] || 'unknown',
    owner_id:    t.owner?.id   || null,
    owner_name:  t.owner?.name || null,
    updated_at:  new Date().toISOString()
  }));

  await this.helpers.httpRequest({
    method: 'POST',
    url:    `${SUPABASE_URL}/rest/v1/cw_tickets`,
    headers: {
      'apikey':       SUPABASE_KEY,
      'Authorization':`Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer':       'resolution=merge-duplicates'
    },
    body: rows,
    json: true
  });

  totalUpserted += rows.length;
  if (batch.length < PAGE_SIZE) break;
  page++;
}

return [{ json: { totalUpserted } }];
