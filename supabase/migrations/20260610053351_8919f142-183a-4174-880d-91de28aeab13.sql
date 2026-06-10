
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'test@sleepio.app') THEN
    UPDATE auth.users
      SET encrypted_password = crypt('TestSleep123!', gen_salt('bf')),
          email_confirmed_at = now(),
          updated_at = now()
      WHERE email = 'test@sleepio.app';
  ELSE
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'test@sleepio.app', crypt('TestSleep123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test User"}'::jsonb, now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'test@sleepio.app'),
      'email', v_user_id::text, now(), now(), now());
  END IF;
END $$;
