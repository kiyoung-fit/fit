// 헬스장 운동 종목 데이터
// pattern: 플랜이 슬롯을 채울 때 쓰는 동작 패턴
// avoid: 이 부위가 아프면 플랜에서 빼는 종목 (back 허리, shoulder 어깨, knee 무릎, wrist 손목)
// beg: 초보자에게 먼저 권하는 종목, inc: 한 번에 올리는 무게(kg), met: 칼로리 추정용
export const MUSCLES = {
  chest: '가슴', back: '등', shoulders: '어깨', quads: '대퇴사두', hams: '햄스트링',
  glutes: '둔근', biceps: '이두', triceps: '삼두', core: '복근·코어', calves: '종아리',
};

export const EQUIP = { barbell: '바벨', dumbbell: '덤벨', machine: '머신', cable: '케이블', body: '맨몸' };

const E = (id, name, muscle, pattern, equip, o = {}) => ({
  id, name, muscle, pattern, equip,
  compound: o.c ?? false, beg: o.beg ?? true, inc: o.inc ?? (equip === 'barbell' ? 2.5 : equip === 'dumbbell' ? 2 : 5), // 맨몸은 추가 무게(벨트 원판) 2.5kg 단위
  avoid: o.avoid ?? [], muscles: o.m, tips: o.t, met: o.met ?? (o.c ? 6 : 4),
});

export const EXERCISES = [
  // 가슴
  E('bench', '바벨 벤치프레스', 'chest', 'hpush', 'barbell', { c: true, avoid: ['shoulder', 'wrist'], m: '대흉근, 삼두, 전면 삼각근',
    t: ['견갑을 모으고 아래로 내려 가슴을 세운다', '바는 명치 위쪽으로 내리고 팔꿈치는 몸통과 45도', '발로 바닥을 밀며 엉덩이는 벤치에 붙인다'] }),
  E('db_bench', '덤벨 벤치프레스', 'chest', 'hpush', 'dumbbell', { c: true, avoid: ['shoulder'], m: '대흉근, 삼두, 전면 삼각근',
    t: ['덤벨을 가슴 옆까지 깊게 내린다', '올릴 때 덤벨끼리 부딪히지 않게 멈춘다', '손목은 꺾지 말고 팔뚝 위에 세운다'] }),
  E('incline_db', '인클라인 덤벨프레스', 'chest', 'hpush', 'dumbbell', { c: true, avoid: ['shoulder'], m: '윗가슴, 전면 삼각근, 삼두',
    t: ['벤치 각도는 30도 안팎', '쇄골 아래쪽으로 내린다', '허리를 과하게 띄우지 않는다'] }),
  E('chest_press', '체스트프레스 머신', 'chest', 'hpush', 'machine', { c: true, m: '대흉근, 삼두',
    t: ['손잡이가 가슴 중앙 높이에 오게 의자를 맞춘다', '등을 패드에 붙이고 견갑을 고정한다', '끝까지 펴되 팔꿈치를 잠그지 않는다'] }),
  E('incline_press_m', '인클라인 프레스 머신', 'chest', 'hpush', 'machine', { c: true, m: '윗가슴, 전면 삼각근',
    t: ['손잡이가 쇄골 높이에 오게 맞춘다', '가슴을 내밀고 밀어낸다', '내릴 때 천천히 2초'] }),
  E('pec_fly', '펙덱 플라이', 'chest', 'chest_iso', 'machine', { m: '대흉근',
    t: ['팔꿈치를 살짝 굽힌 채 고정한다', '안는다는 느낌으로 모은다', '어깨 앞이 당기면 범위를 줄인다'] }),
  E('cable_fly', '케이블 크로스오버', 'chest', 'chest_iso', 'cable', { avoid: ['shoulder'], m: '대흉근',
    t: ['한 발 앞으로 내딛고 상체를 살짝 숙인다', '손이 배꼽 앞에서 만나게 모은다', '팔꿈치 각도는 끝까지 유지한다'] }),
  E('dip', '딥스', 'chest', 'dip', 'body', { c: true, beg: false, avoid: ['shoulder', 'wrist'], m: '아랫가슴, 삼두',
    t: ['상체를 앞으로 숙이면 가슴, 세우면 삼두', '어깨가 귀 쪽으로 올라가지 않게 한다', '팔꿈치 90도까지만 내려간다'] }),
  E('pushup', '푸시업', 'chest', 'hpush', 'body', { c: true, avoid: ['wrist'], m: '대흉근, 삼두, 코어',
    t: ['머리부터 발끝까지 일직선', '가슴이 바닥 가까이 갈 때까지 내린다', '팔꿈치는 45도로 벌린다'] }),

  // 등
  E('lat_pd', '랫풀다운', 'back', 'vpull', 'cable', { c: true, m: '광배근, 이두',
    t: ['가슴을 들고 바를 쇄골 쪽으로 당긴다', '팔이 아니라 팔꿈치를 옆구리로 끌어내린다', '올릴 때 광배가 늘어나는 느낌까지'] }),
  E('pullup', '풀업 (턱걸이)', 'back', 'vpull', 'body', { c: true, beg: false, avoid: ['shoulder'], m: '광배근, 이두, 능형근',
    t: ['매달린 상태에서 견갑을 먼저 끌어내린다', '턱이 바를 넘을 때까지', '반동 없이 천천히 내려온다'] }),
  E('assist_pullup', '어시스트 풀업 머신', 'back', 'vpull', 'machine', { c: true, m: '광배근, 이두',
    t: ['보조 무게가 클수록 쉬워진다', '가슴을 바 쪽으로 끌어올린다', '보조 무게를 점점 줄여간다'] }),
  E('bb_row', '바벨 로우', 'back', 'hpull', 'barbell', { c: true, beg: false, avoid: ['back'], m: '광배근, 능형근, 후면 삼각근',
    t: ['상체를 45도 숙이고 허리는 곧게', '바를 배꼽 쪽으로 당긴다', '허리가 둥글어지면 무게를 줄인다'] }),
  E('db_row', '원암 덤벨 로우', 'back', 'hpull', 'dumbbell', { c: true, m: '광배근, 능형근',
    t: ['한 손과 무릎을 벤치에 올리고 등을 평평하게', '덤벨을 골반 쪽으로 당긴다', '몸통이 돌아가지 않게 버틴다'] }),
  E('seated_row', '시티드 케이블 로우', 'back', 'hpull', 'cable', { c: true, m: '광배근, 능형근, 승모근 중부',
    t: ['가슴을 세우고 무릎은 살짝 굽힌다', '손잡이를 배꼽으로 당기며 견갑을 모은다', '상체를 앞뒤로 흔들지 않는다'] }),
  E('row_m', '로우 머신', 'back', 'hpull', 'machine', { c: true, m: '광배근, 능형근',
    t: ['가슴 패드에 몸을 붙인다', '팔꿈치를 뒤로 보내며 견갑을 모은다', '천천히 늘려준다'] }),
  E('tbar_row', 'T바 로우', 'back', 'hpull', 'machine', { c: true, beg: false, avoid: ['back'], m: '광배근, 능형근',
    t: ['가슴 패드가 있으면 패드에 기대 허리 부담을 줄인다', '팔꿈치를 몸 가까이', '허리를 둥글게 말지 않는다'] }),
  E('straight_pd', '스트레이트 암 풀다운', 'back', 'back_iso', 'cable', { m: '광배근',
    t: ['팔을 거의 편 채 고정한다', '바를 허벅지 쪽으로 반원 그리며 내린다', '상체 숙임은 고정한다'] }),

  // 다리
  E('squat', '바벨 백스쿼트', 'quads', 'squat', 'barbell', { c: true, beg: false, inc: 5, avoid: ['back', 'knee'], m: '대퇴사두, 둔근, 내전근',
    t: ['바는 승모근 위, 발은 어깨너비', '무릎은 발끝 방향으로 밀고 엉덩이는 뒤로', '허벅지가 바닥과 평행 이상 내려간다'], met: 6 }),
  E('leg_press', '레그프레스', 'quads', 'squat', 'machine', { c: true, inc: 10, avoid: ['knee'], m: '대퇴사두, 둔근',
    t: ['허리와 엉덩이가 패드에서 뜨지 않는 깊이까지', '발은 어깨너비, 발바닥 전체로 민다', '무릎을 완전히 잠그지 않는다'] }),
  E('hack_squat', '핵 스쿼트', 'quads', 'squat', 'machine', { c: true, inc: 10, avoid: ['knee'], m: '대퇴사두, 둔근',
    t: ['등을 패드에 붙이고 내려간다', '무릎이 안으로 모이지 않게', '깊이는 허리가 말리기 전까지'] }),
  E('goblet', '고블릿 스쿼트', 'quads', 'squat', 'dumbbell', { c: true, avoid: ['knee'], m: '대퇴사두, 둔근, 코어',
    t: ['덤벨을 가슴 앞에 세워 든다', '팔꿈치가 무릎 안쪽을 스치게 앉는다', '상체를 세운 채 일어난다'] }),
  E('rdl', '루마니안 데드리프트', 'hams', 'hinge', 'barbell', { c: true, inc: 5, avoid: ['back'], m: '햄스트링, 둔근, 척추기립근',
    t: ['무릎은 살짝만 굽히고 엉덩이를 뒤로 민다', '바는 허벅지에 붙여 내린다', '햄스트링이 당기는 지점까지만'] }),
  E('db_rdl', '덤벨 루마니안 데드리프트', 'hams', 'hinge', 'dumbbell', { c: true, avoid: ['back'], m: '햄스트링, 둔근',
    t: ['덤벨을 허벅지 앞에 붙여 내린다', '등은 곧게, 시선은 바닥 앞쪽', '엉덩이를 앞으로 밀며 일어난다'] }),
  E('deadlift', '컨벤셔널 데드리프트', 'hams', 'hinge', 'barbell', { c: true, beg: false, inc: 5, avoid: ['back'], m: '둔근, 햄스트링, 등 전체',
    t: ['바는 발 중앙 위, 정강이에 닿을 듯', '가슴을 세우고 바를 몸에 붙여 끌어올린다', '맨 위에서 허리를 뒤로 젖히지 않는다'], met: 6 }),
  E('hip_thrust', '힙 쓰러스트', 'glutes', 'hinge', 'barbell', { c: true, inc: 5, m: '둔근, 햄스트링',
    t: ['등 윗부분을 벤치에 걸친다', '턱을 당기고 골반을 위로 민다', '맨 위에서 엉덩이를 1초 조인다'] }),
  E('hip_thrust_m', '힙 쓰러스트 머신', 'glutes', 'hinge', 'machine', { c: true, m: '둔근',
    t: ['패드를 골반 위에 둔다', '정강이가 수직이 되게 발 위치를 잡는다', '허리를 꺾지 말고 골반으로 민다'] }),
  E('lunge', '덤벨 런지', 'quads', 'lunge', 'dumbbell', { c: true, avoid: ['knee'], m: '대퇴사두, 둔근',
    t: ['앞발 무게중심으로 수직으로 내려간다', '뒷무릎이 바닥 가까이까지', '상체는 곧게 세운다'] }),
  E('split_squat', '불가리안 스플릿 스쿼트', 'quads', 'lunge', 'dumbbell', { c: true, beg: false, avoid: ['knee'], m: '대퇴사두, 둔근',
    t: ['뒷발을 벤치에 올린다', '앞발 뒤꿈치로 밀어 올라온다', '균형이 어렵으면 덤벨 없이 시작'] }),
  E('leg_ext', '레그 익스텐션', 'quads', 'quad_iso', 'machine', { avoid: ['knee'], m: '대퇴사두',
    t: ['무릎 축이 기계 축과 맞게 앉는다', '끝에서 1초 멈춘다', '내릴 때 천천히'] }),
  E('leg_curl', '레그 컬', 'hams', 'ham_iso', 'machine', { m: '햄스트링',
    t: ['무릎 축을 기계 축에 맞춘다', '골반이 들리지 않게 누른다', '끝까지 접고 천천히 편다'] }),
  E('calf_raise', '카프 레이즈', 'calves', 'calves', 'machine', { m: '비복근, 가자미근',
    t: ['뒤꿈치를 끝까지 내렸다 올린다', '맨 위에서 1초 멈춘다', '반동 없이'] }),
  E('adductor', '이너 싸이 (내전근 머신)', 'glutes', 'glute_iso', 'machine', { m: '내전근',
    t: ['등을 기대고 천천히 모은다', '반동 없이', '편할 만큼만 벌린다'] }),
  E('abductor', '아웃 싸이 (외전근 머신)', 'glutes', 'glute_iso', 'machine', { m: '중둔근',
    t: ['상체를 살짝 숙이면 둔근에 더 들어간다', '끝에서 1초 멈춘다', '천천히 돌아온다'] }),

  // 어깨
  E('ohp', '바벨 오버헤드프레스', 'shoulders', 'vpush', 'barbell', { c: true, beg: false, avoid: ['shoulder', 'back'], m: '삼각근, 삼두',
    t: ['엉덩이와 복근에 힘을 주고 선다', '바는 얼굴을 스치며 수직으로', '허리를 뒤로 꺾지 않는다'] }),
  E('db_ohp', '덤벨 숄더프레스', 'shoulders', 'vpush', 'dumbbell', { c: true, avoid: ['shoulder'], m: '전면·측면 삼각근, 삼두',
    t: ['벤치를 거의 세워 앉는다', '덤벨은 귀 높이까지 내린다', '머리 위에서 모으되 부딪히지 않게'] }),
  E('shoulder_press_m', '숄더프레스 머신', 'shoulders', 'vpush', 'machine', { c: true, m: '삼각근, 삼두',
    t: ['손잡이가 어깨 높이에 오게 의자를 맞춘다', '등을 패드에 붙인다', '팔꿈치를 잠그지 않는다'] }),
  E('lat_raise', '사이드 레터럴 레이즈', 'shoulders', 'side_delt', 'dumbbell', { m: '측면 삼각근',
    t: ['팔꿈치를 살짝 굽히고 옆으로 든다', '어깨 높이까지만', '승모근이 들리지 않게 가볍게'] }),
  E('cable_lat', '케이블 레터럴 레이즈', 'shoulders', 'side_delt', 'cable', { m: '측면 삼각근',
    t: ['케이블을 몸 앞쪽으로 교차해 잡는다', '팔꿈치로 끌어올린다', '내릴 때 천천히'] }),
  E('rear_fly', '리어 델트 플라이 머신', 'shoulders', 'rear_delt', 'machine', { m: '후면 삼각근',
    t: ['펙덱 머신을 반대로 앉아 사용한다', '팔을 옆으로 벌려 뒤로', '견갑을 너무 모으지 않는다'] }),
  E('face_pull', '페이스 풀', 'shoulders', 'rear_delt', 'cable', { m: '후면 삼각근, 회전근개',
    t: ['로프를 얼굴 높이로 당긴다', '당기면서 손을 귀 옆으로 벌린다', '가벼운 무게로 정확하게'] }),

  // 팔
  E('bb_curl', '바벨 컬', 'biceps', 'biceps', 'barbell', { avoid: ['wrist'], m: '이두',
    t: ['팔꿈치를 옆구리에 고정한다', '반동 없이 올린다', '내릴 때 2초'] }),
  E('db_curl', '덤벨 컬', 'biceps', 'biceps', 'dumbbell', { m: '이두',
    t: ['올리면서 새끼손가락 쪽을 바깥으로 돌린다', '팔꿈치가 앞으로 나가지 않게', '번갈아 해도 된다'] }),
  E('hammer', '해머 컬', 'biceps', 'biceps', 'dumbbell', { m: '상완요골근, 이두',
    t: ['손바닥이 서로 마주 보게 잡는다', '팔꿈치는 고정', '천천히 내린다'] }),
  E('cable_curl', '케이블 컬', 'biceps', 'biceps', 'cable', { m: '이두',
    t: ['케이블 앞에서 한 걸음 떨어져 선다', '끝까지 접어 1초 조인다', '상체를 흔들지 않는다'] }),
  E('pushdown', '케이블 푸시다운', 'triceps', 'triceps', 'cable', { m: '삼두',
    t: ['팔꿈치를 옆구리에 고정한다', '끝까지 펴서 1초 멈춘다', '어깨가 앞으로 말리지 않게'] }),
  E('oh_ext', '오버헤드 케이블 익스텐션', 'triceps', 'triceps', 'cable', { avoid: ['shoulder'], m: '삼두 장두',
    t: ['케이블을 등지고 머리 뒤에서 앞으로 편다', '팔꿈치는 앞을 향해 고정', '깊게 늘려준다'] }),
  E('skull', '라잉 트라이셉스 익스텐션', 'triceps', 'triceps', 'barbell', { beg: false, avoid: ['wrist', 'shoulder'], m: '삼두',
    t: ['EZ바를 이마 뒤쪽으로 내린다', '팔꿈치가 벌어지지 않게', '무게를 무리하게 올리지 않는다'] }),

  // 코어
  E('plank', '플랭크', 'core', 'core', 'body', { inc: 0, m: '복근, 코어',
    t: ['팔꿈치는 어깨 바로 아래', '엉덩이가 처지거나 솟지 않게', '횟수 칸에 초 단위로 기록'] }),
  E('cable_crunch', '케이블 크런치', 'core', 'core', 'cable', { m: '복직근',
    t: ['무릎 꿇고 로프를 머리 옆에 고정', '갈비뼈를 골반 쪽으로 말아 내린다', '엉덩이로 당기지 않는다'] }),
  E('leg_raise', '행잉 레그 레이즈', 'core', 'core', 'body', { beg: false, avoid: ['back'], m: '하복부, 장요근',
    t: ['반동 없이 다리를 든다', '골반을 말아 올리는 느낌', '어려우면 무릎을 굽혀서'] }),
  E('ab_crunch_m', '크런치 머신', 'core', 'core', 'machine', { m: '복직근',
    t: ['패드를 가슴에 대고 앉는다', '몸통을 말아 내린다', '천천히 돌아온다'] }),
];

export const CARDIO = [
  { id: 'treadmill', name: '러닝머신', met: (spd, inc) => spd ? Math.max(3.5, 0.9 * spd + 0.35 * (inc || 0)) : 6 },
  { id: 'cycle', name: '실내 사이클', met: () => 6.8 },
  { id: 'stairs', name: '천국의 계단 (스텝밀)', met: () => 9 },
  { id: 'elliptical', name: '일립티컬', met: () => 5 },
  { id: 'rowing', name: '로잉 머신', met: () => 7 },
  { id: 'walk', name: '걷기 (야외)', met: () => 3.5 },
];

// 직접 추가한 운동의 사진 (id -> data URL), custom.js가 채움
export const PHOTOS = {};

export const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

// 부위별로 고를 수 있는 동작 종류 (내 운동 추가 화면용). pattern은 플랜이 슬롯을 채울 때 쓰는 값
export const PATTERNS = {
  chest: [['hpush', '누르기 (프레스·푸시업)'], ['chest_iso', '모으기 (플라이)'], ['dip', '딥스']],
  back: [['vpull', '위에서 당기기 (풀업·랫풀다운)'], ['hpull', '앞에서 당기기 (로우)'], ['back_iso', '팔 펴고 당기기 (풀다운)']],
  shoulders: [['vpush', '머리 위로 밀기 (프레스)'], ['side_delt', '옆으로 들기 (레이즈)'], ['rear_delt', '뒤로 당기기 (후면)']],
  quads: [['squat', '앉았다 일어나기 (스쿼트·레그프레스)'], ['lunge', '한 다리씩 (런지)'], ['quad_iso', '무릎 펴기 (익스텐션)']],
  hams: [['hinge', '엉덩이 접기 (데드리프트)'], ['ham_iso', '무릎 굽히기 (레그 컬)']],
  glutes: [['hinge', '엉덩이 밀기 (힙 쓰러스트)'], ['glute_iso', '다리 벌리기·모으기']],
  biceps: [['biceps', '팔 굽히기 (컬)']],
  triceps: [['triceps', '팔 펴기 (익스텐션·푸시다운)']],
  core: [['core', '복근·코어']],
  calves: [['calves', '종아리']],
};
const ISO = new Set(['chest_iso', 'back_iso', 'side_delt', 'rear_delt', 'quad_iso', 'ham_iso', 'glute_iso', 'biceps', 'triceps', 'core', 'calves']);

// 직접 추가한 운동을 목록에 합친다 (앱 시작 때와 추가·수정·삭제 때마다 호출)
export function registerCustom(list) {
  for (let i = EXERCISES.length - 1; i >= 0; i--) if (EXERCISES[i].custom) { delete byId[EXERCISES[i].id]; EXERCISES.splice(i, 1); }
  for (const c of list || []) {
    if (c.deleted) { byId[c.id] = { ...toExercise(c), name: `${c.name} (삭제된 운동)`, hidden: true }; continue; }
    const e = toExercise(c);
    EXERCISES.push(e);
    byId[e.id] = e;
  }
}
function toExercise(c) {
  const compound = c.compound ?? !ISO.has(c.pattern);
  return {
    id: c.id, name: c.name, muscle: c.muscle, pattern: c.pattern, equip: c.equip, compound, beg: true,
    inc: c.equip === 'barbell' ? 2.5 : c.equip === 'dumbbell' ? 2 : c.equip === 'body' ? 2.5 : 5,
    avoid: [], muscles: `${MUSCLES[c.muscle]} (직접 추가)`, tips: c.memo ? [c.memo] : [], met: compound ? 6 : 4, custom: true, photo: !!c.photo,
  };
}
