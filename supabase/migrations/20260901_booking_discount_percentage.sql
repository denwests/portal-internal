-- Pluno Portal - Booking Discount Percentage
-- discount is stored as percentage, e.g. 10 = 10%.

alter table public.bookings
  add column if not exists discount numeric(5,2) not null default 0;

-- If the v11 nominal-discount migration was already applied,
-- convert the column type safely. Values above 100 are reset to 0
-- because they cannot represent a valid percentage.
alter table public.bookings
  alter column discount type numeric(5,2)
  using (
    case
      when discount between 0 and 100 then discount::numeric(5,2)
      else 0
    end
  );

alter table public.bookings
  alter column discount set default 0;

update public.bookings
set discount = 0
where discount is null
   or discount < 0
   or discount >= 100;

alter table public.bookings
  drop constraint if exists bookings_discount_non_negative;

alter table public.bookings
  drop constraint if exists bookings_discount_percentage_range;

alter table public.bookings
  add constraint bookings_discount_percentage_range
  check (discount >= 0 and discount < 100);

comment on column public.bookings.discount is
  'Package discount percentage. Example: 10 = 10 percent.';
