-- CW tickets table
create table if not exists cw_tickets (
  id bigint primary key,
  summary text,
  status text,
  priority text,
  board text,
  ticket_type text,
  owner_id bigint,
  owner_name text,
  updated_at timestamptz default now()
);

create index if not exists idx_cw_tickets_owner on cw_tickets(owner_id);
create index if not exists idx_cw_tickets_type  on cw_tickets(ticket_type);

-- Capacity RPC function
create or replace function get_cw_capacity()
returns json language sql stable as $$
  with
    owned as (
      select * from cw_tickets where owner_id is not null
    ),
    unassigned as (
      select * from cw_tickets where owner_id is null
    ),
    member_agg as (
      select
        owner_id,
        owner_name,
        count(*)::int                                                      as ticket_count,
        count(*) filter (where ticket_type = 'service')::int              as service_count,
        count(*) filter (where ticket_type = 'new_equipment')::int        as new_equipment_count,
        json_agg(
          json_build_object(
            'id',         id,
            'summary',    summary,
            'status',     status,
            'priority',   priority,
            'board',      board,
            'ticketType', ticket_type
          ) order by id
        ) as tickets
      from owned
      group by owner_id, owner_name
    )
  select json_build_object(
    'success',                true,
    'timestamp',              now(),
    'totalTicketsRaw',        (select count(*)::int from cw_tickets),
    'totalTicketsMatched',    (select count(*)::int from owned),
    'totalTicketsExtras',     (select count(*)::int from unassigned),
    'totalTickets',           (select count(*)::int from owned),
    'serviceTicketCount',     (select count(*)::int from cw_tickets where ticket_type = 'service'),
    'newEquipmentTicketCount',(select count(*)::int from cw_tickets where ticket_type = 'new_equipment'),
    'unmatchedCount',         (select count(*)::int from unassigned),
    'members', coalesce(
      (
        select json_agg(
          json_build_object(
            'memberId',              owner_id,
            'name',                  owner_name,
            'ticketCount',           ticket_count,
            'serviceTicketCount',    service_count,
            'newEquipmentTicketCount', new_equipment_count,
            'tickets',               tickets
          ) order by owner_name
        )
        from member_agg
      ),
      '[]'::json
    ),
    'extras', case
      when (select count(*) from unassigned) > 0
      then json_build_array(
        json_build_object(
          'memberId',              null,
          'name',                  'Unassigned',
          'ticketCount',           (select count(*)::int from unassigned),
          'serviceTicketCount',    (select count(*)::int from unassigned where ticket_type = 'service'),
          'newEquipmentTicketCount',(select count(*)::int from unassigned where ticket_type = 'new_equipment'),
          'tickets', (
            select json_agg(
              json_build_object(
                'id', id, 'summary', summary, 'status', status,
                'priority', priority, 'board', board, 'ticketType', ticket_type
              ) order by id
            )
            from unassigned
          )
        )
      )
      else '[]'::json
    end
  )
$$;
