#!/usr/bin/env bash
# รันชุดทดสอบทั้งหมดแล้วสรุปผลเป็นตาราง
#
# รันด้วย: npm run test:e2e
#
# ⚠️ ต้องดูรหัสจบของแต่ละเทสต์ ห้ามดูแค่ว่ามีเครื่องหมาย ❌ บนจอหรือไม่
#    เทสต์ที่ล้มกลางคัน (เช่น หาปุ่มไม่เจอจนหมดเวลา) จะจบด้วย exception
#    โดยไม่มีเครื่องหมาย ❌ สักตัว ถ้าดูแค่หน้าจอจะนับว่า "ผ่าน" ทั้งที่ไม่ได้รัน
#    ซึ่งเคยหลอกเราไปแล้วครั้งหนึ่ง
set -u
BASE="${BASE_URL:-http://localhost:3100}"
TESTS=(
  e2e-register-flow e2e-full-flow e2e-staff-flow e2e-offline-sync
  e2e-admin-flow e2e-admin-media e2e-multi-event e2e-audit-fixes e2e-security
)
tmp="$(mktemp -d)"
failed=0
skipped=0

printf '\n🧪 ชุดทดสอบทั้งหมด (%s)\n\n' "$BASE"
for t in "${TESTS[@]}"; do
  printf '%-22s ' "$t"
  if BASE_URL="$BASE" node "tests/$t.mjs" "$tmp/$t.png" > "$tmp/$t.log" 2>&1; then
    if grep -q "ข้ามเทสต์นี้" "$tmp/$t.log"; then
      skipped=$((skipped + 1))
      echo "⏭️  ข้าม — $(grep -A1 'ข้ามเทสต์นี้' "$tmp/$t.log" | tail -1 | sed 's/^ *//')"
    else
      echo "✅"
    fi
  else
    failed=$((failed + 1))
    echo "❌"
    grep "❌" "$tmp/$t.log" | head -3 | sed 's/^/     /'
    tail -3 "$tmp/$t.log" | sed 's/^/     /'
  fi
done

printf '\n'
if [ "$failed" -eq 0 ]; then
  printf '✅ ผ่านทั้งหมด'
  [ "$skipped" -gt 0 ] && printf ' (ข้าม %d ตัว)' "$skipped"
  printf '\n\n'
  rm -rf "$tmp"
  exit 0
fi
printf '❌ ไม่ผ่าน %d ตัว — บันทึกเต็มอยู่ที่ %s\n\n' "$failed" "$tmp"
exit 1
