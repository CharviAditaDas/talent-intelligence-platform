set -u
cd /home/claude/talentiq
nohup npx next start -p 3000 > /tmp/server.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:3000/ && break
  sleep 1
done

PASS=0; FAIL=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  PASS  $1 ($3)";
  else FAIL=$((FAIL+1)); echo "  FAIL  $1 (expected $2, got $3)"; fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo ""
echo "[Public routes render without auth]"
check "landing page"        200 "$(code http://localhost:3000/)"
check "public job board"    200 "$(code http://localhost:3000/jobs)"
check "login page"          200 "$(code http://localhost:3000/login)"
check "unknown page is 404" 404 "$(code http://localhost:3000/no-such-page)"

echo ""
echo "[Protected pages redirect anonymous users to /login]"
for p in /candidate /recruiter /admin /admin/users /admin/ai /admin/system \
         /recruiter/pipeline /recruiter/jobs /recruiter/jobs/new \
         /candidate/resume /candidate/profile /candidate/applications; do
  loc=$(curl -s -o /dev/null -w "%{redirect_url}" "http://localhost:3000$p")
  st=$(code "http://localhost:3000$p")
  case "$loc" in
    *"/login"*) PASS=$((PASS+1)); echo "  PASS  $p -> login ($st)";;
    *)          FAIL=$((FAIL+1)); echo "  FAIL  $p -> '$loc' ($st)";;
  esac
done

echo ""
echo "[API routes reject unauthenticated callers]"
check "POST /api/applications"        401 "$(code -X POST -H 'Content-Type: application/json' -d '{"jobId":"00000000-0000-0000-0000-000000000000"}' http://localhost:3000/api/applications)"
check "PUT  /api/profile"             401 "$(code -X PUT -H 'Content-Type: application/json' -d '{"fullName":"x"}' http://localhost:3000/api/profile)"
check "POST /api/jobs"                401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/jobs)"
check "POST /api/resumes/upload"      401 "$(code -X POST http://localhost:3000/api/resumes/upload)"
check "POST /api/match/preview"       401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/match/preview)"
check "POST /api/compare"             401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/compare)"
check "POST /api/interview/prep"      401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/interview/prep)"
check "POST /api/interview/practice"  401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/interview/practice)"
check "POST /api/resumes/rewrite"     401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/resumes/rewrite)"
check "PATCH /api/admin/ai-settings"  401 "$(code -X PATCH -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/admin/ai-settings)"
check "PATCH /api/admin/users/[id]"   401 "$(code -X PATCH -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/admin/users/00000000-0000-0000-0000-000000000000)"
check "GET  /api/export/job/[id]"     401 "$(code http://localhost:3000/api/export/job/00000000-0000-0000-0000-000000000000)"
check "GET  /api/resumes/[id]/url"    401 "$(code http://localhost:3000/api/resumes/00000000-0000-0000-0000-000000000000/url)"
check "PATCH /api/applications/[id]/stage" 401 "$(code -X PATCH -H 'Content-Type: application/json' -d '{"stage":"hired"}' http://localhost:3000/api/applications/00000000-0000-0000-0000-000000000000/stage)"

echo ""
echo "[Worker rejects anonymous callers without a secret]"
check "no token"      401 "$(code -X POST http://localhost:3000/api/worker/drain)"
check "wrong token"   401 "$(code -X POST -H 'Authorization: Bearer wrong_secret_value_x' http://localhost:3000/api/worker/drain)"
check "empty bearer"  401 "$(code -X POST -H 'Authorization: Bearer ' http://localhost:3000/api/worker/drain)"
check "GET also gated" 401 "$(code http://localhost:3000/api/worker/drain)"

echo ""
echo "[Security headers]"
H=$(curl -s -D - -o /dev/null http://localhost:3000/)
echo "$H" | grep -qi "x-frame-options: SAMEORIGIN" && { PASS=$((PASS+1)); echo "  PASS  X-Frame-Options"; } || { FAIL=$((FAIL+1)); echo "  FAIL  X-Frame-Options"; }
echo "$H" | grep -qi "x-content-type-options: nosniff" && { PASS=$((PASS+1)); echo "  PASS  X-Content-Type-Options"; } || { FAIL=$((FAIL+1)); echo "  FAIL  X-Content-Type-Options"; }
echo "$H" | grep -qi "referrer-policy" && { PASS=$((PASS+1)); echo "  PASS  Referrer-Policy"; } || { FAIL=$((FAIL+1)); echo "  FAIL  Referrer-Policy"; }
echo "$H" | grep -qi "x-powered-by" && { FAIL=$((FAIL+1)); echo "  FAIL  X-Powered-By leaked"; } || { PASS=$((PASS+1)); echo "  PASS  X-Powered-By suppressed"; }

echo ""
echo "[No secrets in served HTML]"
BODY=$(curl -s http://localhost:3000/)
echo "$BODY" | grep -q "service.placeholder" && { FAIL=$((FAIL+1)); echo "  FAIL  service role key in HTML"; } || { PASS=$((PASS+1)); echo "  PASS  no service role key in HTML"; }
echo "$BODY" | grep -q "gsk_placeholder" && { FAIL=$((FAIL+1)); echo "  FAIL  Groq key in HTML"; } || { PASS=$((PASS+1)); echo "  PASS  no Groq key in HTML"; }
echo "$BODY" | grep -q "test_worker_secret" && { FAIL=$((FAIL+1)); echo "  FAIL  worker secret in HTML"; } || { PASS=$((PASS+1)); echo "  PASS  no worker secret in HTML"; }

echo ""
echo "[Landing page renders real content]"
echo "$BODY" | grep -q "Requirement matrix" && { PASS=$((PASS+1)); echo "  PASS  requirement matrix hero present"; } || { FAIL=$((FAIL+1)); echo "  FAIL  hero missing"; }
echo "$BODY" | grep -q "Not demonstrated" && { PASS=$((PASS+1)); echo "  PASS  evidence states rendered"; } || { FAIL=$((FAIL+1)); echo "  FAIL  evidence states missing"; }

echo ""
echo "===================================================="
echo "$PASS passed, $FAIL failed"
echo "===================================================="
kill $SRV 2>/dev/null
exit $FAIL
