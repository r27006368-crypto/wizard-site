-- ============================================================
-- АНТИ-БОТ (серверная проверка hashcash PoW)
-- Запусти этот скрипт целиком в Supabase SQL Editor.
-- Без него сайт РАБОТАЕТ: клиентская проверка включается автоматически,
-- просто сервер не сверяет доказательство.
-- После запуска каждая регистрация / покупка / генерация ключа
-- проходит проверку доказательства работы + защиту от повтора (replay).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Колонки доказательства для всех таблиц, куда боты пишут данные
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pow_nonce TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pow_ms INT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pow_at BIGINT;

DO $$ BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pow_nonce TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pow_ms INT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pow_at BIGINT;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.app_keys') IS NOT NULL THEN
    ALTER TABLE public.app_keys ADD COLUMN IF NOT EXISTS pow_nonce TEXT;
    ALTER TABLE public.app_keys ADD COLUMN IF NOT EXISTS pow_ms INT;
    ALTER TABLE public.app_keys ADD COLUMN IF NOT EXISTS pow_at BIGINT;
  END IF;
END $$;

-- Журнал использованных доказательств (защита от повтора)
CREATE TABLE IF NOT EXISTS public.powlog (
  nonce TEXT PRIMARY KEY,
  at BIGINT NOT NULL DEFAULT 0
);

-- Ядро проверки: hashcash доказательство + окно времени + анти-повтор
CREATE OR REPLACE FUNCTION public.antibot_ok(v_base TEXT, v_nonce TEXT, v_ms INT, v_at BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hex TEXT;
  v_now BIGINT := (extract(epoch from clock_timestamp())::bigint) * 1000;
  v_ok BOOLEAN;
BEGIN
  IF v_nonce IS NULL OR v_ms IS NULL OR v_at IS NULL THEN RETURN FALSE; END IF;
  IF v_at < v_now - 300000 OR v_at > v_now + 300000 THEN RETURN FALSE; END IF; -- не старше 5 минут
  IF v_ms < 400 OR v_ms > 120000 THEN RETURN FALSE; END IF;                    -- слишком быстро = бот

  v_hex := encode(digest(v_base || ':wz.antibot.2026:' || v_nonce, 'sha256'), 'hex');

  -- сложность адаптивная: чем дольше решал клиент, тем меньше нулей нужно
  IF left(v_hex, 5) = '00000' THEN v_ok := TRUE;
  ELSIF left(v_hex, 4) = '0000' AND v_ms > 1500 THEN v_ok := TRUE;
  ELSIF left(v_hex, 3) = '000' AND v_ms > 5000 THEN v_ok := TRUE;
  ELSIF left(v_hex, 2) = '00' AND v_ms > 10000 THEN v_ok := TRUE;
  ELSE v_ok := FALSE;
  END IF;

  IF NOT v_ok THEN RETURN FALSE; END IF;

  -- анти-повтор: одно доказательство можно использовать один раз
  INSERT INTO public.powlog(nonce, at) VALUES (v_nonce, v_now) ON CONFLICT (nonce) DO NOTHING;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  DELETE FROM public.powlog WHERE at < v_now - 7200000; -- подчистка старых
  RETURN TRUE;
END $$;

-- Триггер-защитник: без валидного доказательства INSERT отклоняется
CREATE OR REPLACE FUNCTION public.antibot_tg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_base TEXT;
BEGIN
  IF TG_TABLE_NAME = 'app_keys' THEN v_base := lower(NEW.code);
  ELSE v_base := lower(NEW.nick); END IF;

  IF NEW.pow_nonce IS NULL OR NOT public.antibot_ok(v_base, NEW.pow_nonce, NEW.pow_ms, NEW.pow_at) THEN
    RAISE EXCEPTION 'bot: proof rejected';
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF to_regclass('public.accounts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tg_ab_accounts ON public.accounts';
    EXECUTE 'CREATE TRIGGER tg_ab_accounts BEFORE INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.antibot_tg()';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tg_ab_orders ON public.orders';
    EXECUTE 'CREATE TRIGGER tg_ab_orders BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.antibot_tg()';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.app_keys') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tg_ab_app_keys ON public.app_keys';
    EXECUTE 'CREATE TRIGGER tg_ab_app_keys BEFORE INSERT ON public.app_keys FOR EACH ROW EXECUTE FUNCTION public.antibot_tg()';
  END IF;
END $$;