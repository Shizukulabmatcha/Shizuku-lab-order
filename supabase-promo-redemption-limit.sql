-- Shizuku Lab promo redemption protection
-- Run this whole file once in Supabase SQL Editor.

-- Standardise existing records first.
update public.promo_redemptions
set
  code = upper(trim(code)),
  phone = case
    when length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) = 10
         and left(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 2) = '65'
    then right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8)
    else regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
  end;

-- Keep only the earliest record if old duplicates already exist.
delete from public.promo_redemptions newer
using public.promo_redemptions older
where upper(trim(newer.code)) = upper(trim(older.code))
  and newer.phone = older.phone
  and newer.ctid > older.ctid;

-- Database-level guarantee: one phone may use each code only once.
create unique index if not exists promo_redemptions_one_phone_per_code
on public.promo_redemptions (code, phone);

create or replace function public.normalise_shizuku_promo_redemption()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  phone_digits text;
begin
  new.code := upper(trim(new.code));
  phone_digits := regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g');
  if length(phone_digits) = 10 and left(phone_digits, 2) = '65' then
    phone_digits := right(phone_digits, 8);
  end if;
  new.phone := phone_digits;
  return new;
end;
$$;

drop trigger if exists normalise_shizuku_promo_redemption
on public.promo_redemptions;

create trigger normalise_shizuku_promo_redemption
before insert or update of code, phone
on public.promo_redemptions
for each row
execute function public.normalise_shizuku_promo_redemption();
