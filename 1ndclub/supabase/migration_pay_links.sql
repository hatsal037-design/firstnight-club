-- 금액 고정 카카오페이 송금 링크 (5천~5만, 햇살님이 앱에서 생성한 QR 43종 해독)
create table if not exists public.pay_links (
  amount int primary key,
  link   text not null
);
alter table public.pay_links enable row level security;
drop policy if exists pay_read  on public.pay_links;
drop policy if exists pay_write on public.pay_links;
create policy pay_read  on public.pay_links for select using (true);
create policy pay_write on public.pay_links for all
  using (public.my_is_staff()) with check (public.my_is_staff());
grant select on public.pay_links to anon, authenticated;
grant insert, update, delete on public.pay_links to authenticated;
grant all on public.pay_links to service_role;

insert into public.pay_links (amount, link) values
  (5000, 'https://qr.kakaopay.com/2810060110000849828670079c406743'),
  (6000, 'https://qr.kakaopay.com/281006011000084982867007bb808317'),
  (7000, 'https://qr.kakaopay.com/281006011000084982867007dac05289'),
  (8000, 'https://qr.kakaopay.com/281006011000084982867007fa000456'),
  (9000, 'https://qr.kakaopay.com/281006011000084982867007119405054'),
  (10000, 'https://qr.kakaopay.com/281006011000084982867007138800764'),
  (11000, 'https://qr.kakaopay.com/281006011000084982867007157c05976'),
  (12000, 'https://qr.kakaopay.com/281006011000084982867007177001244'),
  (13000, 'https://qr.kakaopay.com/281006011000084982867007196406526'),
  (15000, 'https://qr.kakaopay.com/2810060110000849828670071d4c08746'),
  (16000, 'https://qr.kakaopay.com/2810060110000849828670071f4003706'),
  (17000, 'https://qr.kakaopay.com/281006011000084982867007213409784'),
  (18000, 'https://qr.kakaopay.com/281006011000084982867007232804882'),
  (19000, 'https://qr.kakaopay.com/281006011000084982867007251c01220'),
  (20000, 'https://qr.kakaopay.com/281006011000084982867007271006196'),
  (21000, 'https://qr.kakaopay.com/281006011000084982867007290402114'),
  (23000, 'https://qr.kakaopay.com/2810060110000849828670072cec01824'),
  (24000, 'https://qr.kakaopay.com/2810060110000849828670072ee008330'),
  (25000, 'https://qr.kakaopay.com/28100601100008498286700730d405206'),
  (26000, 'https://qr.kakaopay.com/28100601100008498286700732c800796'),
  (27000, 'https://qr.kakaopay.com/28100601100008498286700734bc06308'),
  (28000, 'https://qr.kakaopay.com/28100601100008498286700736b001008'),
  (30000, 'https://qr.kakaopay.com/2810060110000849828670073a9800016'),
  (31000, 'https://qr.kakaopay.com/2810060110000849828670073c8c04747'),
  (32000, 'https://qr.kakaopay.com/2810060110000849828670073e8000263'),
  (33000, 'https://qr.kakaopay.com/281006011000084982867007407405297'),
  (34000, 'https://qr.kakaopay.com/281006011000084982867007426809783'),
  (35000, 'https://qr.kakaopay.com/281006011000084982867007445c04695'),
  (36000, 'https://qr.kakaopay.com/281006011000084982867007'),
  (37000, 'https://qr.kakaopay.com/281006011000084982867007484404219'),
  (38000, 'https://qr.kakaopay.com/2810060110000849828670074a3808985'),
  (39000, 'https://qr.kakaopay.com/2810060110000849828670074c2c03772'),
  (40000, 'https://qr.kakaopay.com/2810060110000849828670074e2008338'),
  (41000, 'https://qr.kakaopay.com/281006011000084982867007501404114'),
  (42000, 'https://qr.kakaopay.com/281006011000084982867007520801577'),
  (43000, 'https://qr.kakaopay.com/28100601100008498286700753fc07257'),
  (44000, 'https://qr.kakaopay.com/28100601100008498286700755f002315'),
  (45000, 'https://qr.kakaopay.com/28100601100008498286700757e407526'),
  (46000, 'https://qr.kakaopay.com/28100601100008498286700759d801968'),
  (47000, 'https://qr.kakaopay.com/2810060110000849828670075bcc07198'),
  (48000, 'https://qr.kakaopay.com/2810060110000849828670075dc001726'),
  (49000, 'https://qr.kakaopay.com/2810060110000849828670075fb406530'),
  (50000, 'https://qr.kakaopay.com/28100601100008498286700761a802558')
on conflict (amount) do update set link = excluded.link;