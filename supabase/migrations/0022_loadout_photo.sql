-- Proof without tags (2026-11-04). Most hands carry iPhones, which can't read
-- NFC tags from a website, and few yards use QR codes. So a load-out ends with
-- one photo of the loaded truck, kept on the record and the operator's proof
-- link with the hand's name and the time. On by default in every yard.
-- Typing the last 4 of the serial to check a piece by hand becomes a yard
-- setting, off by default: hands won't punch in serials, and the photo is the proof.
alter table saas_loadout_scans add column if not exists photo_path text;
alter table saas_enforcement_settings add column if not exists require_loadout_photo boolean not null default true;
alter table saas_enforcement_settings add column if not exists require_last4 boolean not null default false;
