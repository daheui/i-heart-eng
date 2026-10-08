# I ♥ ENG — 설치 가이드 (처음 한 번만)

전부 무료예요. 순서대로 따라오면 30분 안에 끝나요. 막히면 어느 단계인지 말해주세요.

## 1. Supabase 프로젝트 만들기
1. https://supabase.com → **Start your project** → GitHub 계정으로 가입/로그인
2. **New project** 클릭
   - Name: `i-heart-eng`
   - Database Password: 아무거나 길게 (메모해두세요, 거의 쓸 일 없음)
   - Region: **Northeast Asia (Seoul)** 또는 Tokyo
   - Plan: Free
3. 1~2분 기다리면 프로젝트가 생겨요.

## 2. 데이터베이스 표 만들기
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 폴더의 `supabase/schema.sql` 파일을 메모장으로 열어 전체 복사 → 붙여넣기 → 오른쪽 아래 **Run**
3. 아래에 `Success. No rows returned` 비슷한 메시지가 뜨면 성공.

## 3. 이메일 확인 끄기 (친구들이 바로 가입할 수 있게)
1. 왼쪽 메뉴 **Authentication** → **Providers** → **Email**
2. **Confirm email** 스위치를 **끄기(OFF)** → Save
   (켜두면 가입할 때 확인 메일을 눌러야 해서 번거로워요)

## 4. 키 복사해서 앱에 넣기
1. 왼쪽 메뉴 **Project Settings**(톱니) → **API**
2. **Project URL** 복사 → `js/config.js`의 `SUPABASE_URL`에 붙여넣기
3. **anon public** 키 복사 → `js/config.js`의 `SUPABASE_ANON_KEY`에 붙여넣기
4. 같은 파일의 `INVITE_CODE`를 친구들에게만 알려줄 코드로 바꾸기 (예: `nyc2026`)

> anon 키는 공개돼도 괜찮은 키예요 (권한은 2단계에서 만든 RLS 규칙이 막아줘요).

## 5. GitHub에 올리고 페이지 켜기
1. https://github.com → **New repository**
   - Name: `i-heart-eng`, Public, 나머지 기본값 → Create
2. 저장소 화면에서 **uploading an existing file** 링크 클릭 → 이 폴더의 파일들을 **폴더 구조 그대로** 끌어다 놓기
   (index.html, sw.js, manifest.webmanifest, css/, js/, icons/, supabase/ 전부) → **Commit changes**
3. 저장소 **Settings** → 왼쪽 **Pages** → Branch: `main`, 폴더 `/ (root)` → Save
4. 1~2분 뒤 같은 화면 위쪽에 주소가 떠요: `https://<내아이디>.github.io/i-heart-eng/`
   이게 앱 링크예요.

## 6. 처음 접속
1. 링크 열기 → **Sign up** → 이메일, 비밀번호, 닉네임, 가입 코드 입력
2. 온보딩 5장 보고 시작 → Me 탭에서 사진과 한 줄 다짐
3. 폰에서: 사파리로 열고 공유 → **홈 화면에 추가** (안드로이드: 크롬 메뉴 → 홈 화면에 추가)
4. 친구들에게 링크 + 가입 코드 보내기

## 7. 3명 다 가입한 뒤 (선택)
- Supabase → Authentication → Providers → Email → **Allow new users to sign up** 끄기
  → 코드가 새어나가도 아무도 더 못 들어와요.

## 나중에 앱을 고칠 때
Claude가 새 파일을 주면 GitHub 저장소에서 해당 파일을 열고 연필(Edit) → 내용 교체 → Commit.
또는 폴더 통째로 다시 업로드. 1~2분 뒤 같은 링크에 반영돼요. 기록은 Supabase에 있어서 안 없어져요.
