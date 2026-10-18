-- Keep Singapore and Malaysia product categories independent while allowing
-- the same product to appear in both stores with a different category.
alter table public.product_groups
  add column if not exists market_code text not null default 'SG';

alter table public.product_groups
  drop constraint if exists product_groups_name_key;

alter table public.product_groups
  add constraint product_groups_market_code_check check (market_code in ('SG', 'MY'));

alter table public.product_groups
  add constraint product_groups_market_name_key unique (market_code, name);

alter table public.products
  add column if not exists malaysia_group_id bigint references public.product_groups(id) on delete set null;

create index if not exists products_malaysia_group_id_idx on public.products(malaysia_group_id);

-- Categories used only by Malaysia belong to MY; existing shared categories
-- remain Singapore categories and are copied to Malaysia below.
update public.product_groups g
set market_code = 'MY'
where exists (
  select 1 from public.products p
  where p.group_id = g.id and p.malaysia_available = true
)
and not exists (
  select 1 from public.products p
  where p.group_id = g.id and (p.is_available = true or p.is_b2b = true)
);

insert into public.product_groups (name, sort_order, is_visible, market_code)
select g.name, g.sort_order, g.is_visible, 'MY'
from public.product_groups g
where g.market_code = 'SG'
  and exists (
    select 1 from public.products p
    where p.group_id = g.id and p.malaysia_available = true
  )
on conflict (market_code, name) do nothing;

update public.products p
set malaysia_group_id = my_group.id
from public.product_groups sg_group
join public.product_groups my_group
  on my_group.market_code = 'MY' and my_group.name = sg_group.name
where p.group_id = sg_group.id
  and sg_group.market_code = 'SG'
  and p.malaysia_available = true;

update public.products p
set malaysia_group_id = p.group_id, group_id = null
where p.group_id in (
  select id from public.product_groups where market_code = 'MY'
);
