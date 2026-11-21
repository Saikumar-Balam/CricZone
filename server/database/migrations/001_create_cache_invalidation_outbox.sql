
CREATE TABLE IF NOT EXISTS public.cache_invalidation_outbox (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    event_id UUID NOT NULL UNIQUE,

    match_id BIGINT NOT NULL,

    cache_keys JSONB NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    attempts INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    processed_at TIMESTAMPTZ,

    CONSTRAINT cache_outbox_status_check
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED')),

    CONSTRAINT cache_outbox_attempts_check
        CHECK (attempts >= 0),

    CONSTRAINT cache_outbox_keys_check
        CHECK (jsonb_typeof(cache_keys) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_cache_outbox_pending
ON public.cache_invalidation_outbox (created_at, id)
WHERE status = 'PENDING';
