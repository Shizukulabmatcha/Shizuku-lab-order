-- Run once in Supabase SQL Editor so customers can track with either detail.
drop function if exists public.track_shizuku_order(text, text);

create function public.track_shizuku_order(p_order_number text, p_phone text)
returns setof public.orders
language sql
security definer
set search_path = public
as $$
  select o.* from public.orders o
  where
    (nullif(trim(coalesce(p_order_number,'')), '') is not null
      and upper(o.order_number) = upper(trim(p_order_number)))
    or
    (nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'), '') is not null
      and regexp_replace(coalesce(o.customer_phone,''),'[^0-9]','','g') in (
        regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),
        regexp_replace(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'^65','')
      ))
  order by o.created_at desc
  limit 1;
$$;

grant execute on function public.track_shizuku_order(text,text) to anon, authenticated;
