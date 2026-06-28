user default on >${REDIS_DEFAULT_PASSWORD} -@all +ping
user gateway_user on >${REDIS_GATEWAY_PASSWORD} +xadd +get +set +setex +expire +ping +info ~tenant:by_phone:* ~flow-engine:* ~processed:*
user flow_engine_user on >${REDIS_FLOW_ENGINE_PASSWORD} +xreadgroup +xack +xpending +xclaim +xadd +xgroup +xautoclaim +keys +hgetall +hset +expire +set +get +del +incr +incrby +multi +exec +exists +ping ~session:* ~flow-engine:* ~lock:flow:* ~rate:tenant:* ~processed:* ~tokens:tenant:* ~dry-session:*
user tenant_api_user on >${REDIS_TENANT_API_PASSWORD} +xadd +set +setex +del +get +ping +info ~tenant:by_phone:* ~indexing:* ~auth:blocklist:* ~rate:tenant:*
user rag_indexer_user on >${REDIS_RAG_INDEXER_PASSWORD} +xreadgroup +xack +xpending +xclaim +xgroup +xautoclaim +keys ~indexing:*
