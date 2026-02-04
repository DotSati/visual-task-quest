-- Add key_hash column for secure API key storage
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_hash text;

-- Create a function to hash API keys using SHA-256
-- Note: We use SHA-256 since API keys are high-entropy random strings (not passwords)
-- and bcrypt's slow hashing isn't necessary for high-entropy secrets
CREATE OR REPLACE FUNCTION public.hash_api_key(api_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(sha256(api_key::bytea), 'hex')
$$;

-- Create a function to verify an API key against a hash
CREATE OR REPLACE FUNCTION public.verify_api_key(api_key text, stored_hash text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(sha256(api_key::bytea), 'hex') = stored_hash
$$;

-- Update existing keys to have hashes (so existing keys still work)
UPDATE public.api_keys 
SET key_hash = encode(sha256(key::bytea), 'hex')
WHERE key_hash IS NULL AND key IS NOT NULL;

-- Add comment explaining the security model
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the API key for secure storage and verification';
COMMENT ON COLUMN public.api_keys.key IS 'Deprecated: Will be cleared after migration. Use key_hash for verification.';