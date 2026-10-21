-- Clara · migração 006: destinos alimentados só pelo EGO (feed).
-- Confirmado pela Andreia: no RightMove não se edita; só se vê estado e relatórios.
UPDATE portal SET grupo = 'feed_only', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 'rightmove-pt';
