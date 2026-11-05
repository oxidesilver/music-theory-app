// ジャンル別作曲講座の教材（指示書 4-7）
// ここに書いた内容は、各ジャンルの楽曲で「よく見られる傾向」です。
// 1つの BPM やコード進行がそのジャンルの絶対的な特徴というわけではなく、曲やアーティストによって大きく異なります。
// 実在の曲のメロディーや歌詞は収録せず、一般的なリズムの型・コード進行の型だけを例として使っています。

import type { ChordRhythm, BassPattern } from '@/features/compose/logic';

export type GenreId = 'japareggae' | 'dancehall' | 'edm' | 'hiphop' | 'rnb' | 'pops' | 'rock';

/** ドラムの指定：GM ドラム番号ごとに、1小節16ステップのうち鳴らすステップ */
export type DrumSteps = Partial<Record<number, number[]>>;

export interface RhythmExample {
  id: string;
  name: string;
  description: string;
  drums: DrumSteps;
  chordRhythm: ChordRhythm;
  bass: BassPattern;
}

export interface GenreSample {
  id: string;
  name: string;
  description: string;
  tonic: string;
  mode: 'major' | 'minor';
  bpm: number;
  /** ローマ数字（日本式・キーの基準スケール）。1つ = 1小節 */
  romans: string[];
  rhythm: string; // RhythmExample の id
}

export interface Genre {
  id: GenreId;
  name: string;
  icon: string;
  summary: string;
  bpm: { min: number; max: number; note: string };
  /** 指示書の学習内容（特徴・リズム・コード進行・スケール・ベース・メロディー・アレンジ・音色） */
  sections: { title: string; points: string[] }[];
  rhythms: RhythmExample[];
  samples: GenreSample[];
  exercises: string[];
}

const HAT8 = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT16 = Array.from({ length: 16 }, (_, i) => i);
const OFF8 = [2, 6, 10, 14];

export const GENRES: Genre[] = [
  {
    id: 'japareggae',
    name: 'ジャパレゲ',
    icon: '🌴',
    summary: 'ジャマイカのレゲエやダンスホールの影響を受けた、日本語で歌われるレゲエ。日本のポップスに通じる歌いやすいメロディーと、裏打ちのリズムが組み合わさっているのが特徴です。',
    bpm: { min: 70, max: 105, note: 'ゆったりしたラヴァーズ系は遅め、ダンスホール寄りの曲は速めになる傾向があります。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['レゲエ・ダンスホールのリズムに、日本語の歌（メロディーのある歌と、リズミカルに言葉を乗せる歌い方の両方）を乗せるスタイル。', 'パーティー向けの盛り上がる曲から、ラブソングや応援歌まで幅があります。'] },
      { title: 'リズムの特徴', points: ['ギターや鍵盤が拍の **裏** で短く鳴る「裏打ち（スカンク）」が基本。', '3拍目にキックとスネアを重ねる「ワンドロップ」や、キックを毎拍鳴らす「ステッパーズ」などの型があります。'] },
      { title: 'コード進行の傾向', points: ['マイナーキーの短い循環進行（例：Ⅰm–Ⅵ–Ⅶ）が多く使われます。', 'J-POP 由来のメジャーキーの進行（王道進行・カノン進行など）が使われる曲もあります。'] },
      { title: '使用するスケールの傾向', points: ['メロディーはキーのメジャー／ナチュラルマイナースケールが中心。', 'リズミカルな歌の部分では、マイナーペンタトニックのような少ない音で組み立てることもあります。'] },
      { title: 'ベースラインの特徴', points: ['低く太いベースが曲の中心。音数を絞り、休符（音を鳴らさない時間）を活かしたフレーズが多いです。'] },
      { title: 'メロディーの特徴', points: ['日本語の歌詞が聞き取りやすい、歌謡曲やポップスに近いメロディー。サビは高めの音域で盛り上げる傾向があります。'] },
      { title: 'アレンジの特徴', points: ['ドラム・ベース・裏打ちの楽器が土台。オルガンの細かい刻みやホーン（管楽器）が加わることもあります。'] },
      { title: '音色の特徴', points: ['オルガン、クリーンなギター、プラック系のシンセ（短く弾くような音）、太いベース。'] },
    ],
    rhythms: [
      { id: 'onedrop', name: 'ワンドロップ', description: '3拍目にキックとスネアを重ねる、ゆったりとした伝統的なレゲエのリズム。1拍目にキックが無いのが特徴です。', drums: { 36: [8], 38: [8], 42: HAT8 }, chordRhythm: 'offbeat', bass: 'whole' },
      { id: 'steppers', name: 'ステッパーズ', description: 'キックを毎拍鳴らす、前に進むような力強いリズム。', drums: { 36: [0, 4, 8, 12], 38: [8], 42: HAT8 }, chordRhythm: 'offbeat', bass: 'quarter' },
      { id: 'offbeat-only', name: '裏打ちだけ', description: 'ドラムを抜いて、裏打ちのコードだけを聴いてみましょう。「ン・チャ・ン・チャ」というノリの正体です。', drums: {}, chordRhythm: 'offbeat', bass: 'whole' },
    ],
    samples: [
      { id: 'minor-loop', name: 'マイナーの循環（ワンドロップ）', description: 'マイナーキーの定番の循環進行に、裏打ちとワンドロップを合わせた例。', tonic: 'A', mode: 'minor', bpm: 80, romans: ['Ⅰm', 'Ⅵ', 'Ⅶ', 'Ⅰm'], rhythm: 'onedrop' },
      { id: 'major-steppers', name: 'メジャーの進行（ステッパーズ）', description: 'J-POP でもおなじみの進行を、ステッパーズのリズムで。', tonic: 'D', mode: 'major', bpm: 96, romans: ['Ⅳ', 'Ⅴ', 'Ⅲm', 'Ⅵm'], rhythm: 'steppers' },
    ],
    exercises: ['サンプルを開き、メロディーをペンタトニックの音だけで4小節作ってみましょう。', 'ワンドロップとステッパーズを切り替えて、同じメロディーの印象がどう変わるか聴き比べましょう。'],
  },
  {
    id: 'dancehall',
    name: 'ダンスホール',
    icon: '🔊',
    summary: 'ジャマイカ発祥の、レゲエから発展したダンスミュージック。電子楽器で作られたリズム（リディム）の上で、リズミカルに歌うスタイルが中心です。',
    bpm: { min: 85, max: 110, note: '曲や時代によって幅があります。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['同じトラック（リディム）を、たくさんの歌い手が使い回す文化があります。', 'コードよりもリズムとベースが主役になる曲が多いです。'] },
      { title: 'リズムの特徴', points: ['「3+3+2」（8分音符3つ・3つ・2つに区切る）のような、はねたシンコペーション（拍をずらしたリズム）がよく使われます。', 'キック・スネア・クラップを細かく組み合わせた、跳ねるようなリズムが特徴です。'] },
      { title: 'コード進行の傾向', points: ['1〜2個のコードの繰り返し（ループ）だけで曲ができていることも多いです。', 'マイナーキーが多い傾向があります。'] },
      { title: '使用するスケールの傾向', points: ['マイナー系（ナチュラルマイナー、マイナーペンタトニック）が中心。'] },
      { title: 'ベースラインの特徴', points: ['リズムに合わせて動く、太いシンセベース。キックと同じタイミングで鳴らすことが多いです。'] },
      { title: 'メロディーの特徴', points: ['音の高さよりもリズムを重視した歌（ディージェイ／トースティング）が多く、少ない音を繰り返すフレーズが中心です。'] },
      { title: 'アレンジの特徴', points: ['音数を少なくして、リズムと低音を目立たせる作り方がよく見られます。'] },
      { title: '音色の特徴', points: ['デジタルなシンセ、太いシンセベース、クラップ、リムショット、効果音。'] },
    ],
    rhythms: [
      { id: 'tresillo', name: '3+3+2 のキック', description: 'キックを「3+3+2」（16分音符で 0・6・12 番目）に置いた例。ダンスホールらしい跳ねるノリが出ます。', drums: { 36: [0, 6, 12], 39: [4, 12], 42: HAT8 }, chordRhythm: 'sustain', bass: 'whole' },
      { id: 'minimal', name: 'ミニマル（キックとクラップ）', description: '音数をしぼった例。ベースと歌が目立ちます。', drums: { 36: [0, 8], 39: [4, 12] }, chordRhythm: 'sustain', bass: 'whole' },
    ],
    samples: [
      { id: 'two-chord', name: '2コードのループ', description: 'Ⅰm と Ⅵ を行き来するだけの、シンプルなループ。', tonic: 'G', mode: 'minor', bpm: 98, romans: ['Ⅰm', 'Ⅵ', 'Ⅰm', 'Ⅵ'], rhythm: 'tresillo' },
      { id: 'minor-four', name: 'マイナーの4コード', description: 'Ⅰm–Ⅳm–Ⅶ–Ⅲ の循環。', tonic: 'F#', mode: 'minor', bpm: 95, romans: ['Ⅰm', 'Ⅳm', 'Ⅶ', 'Ⅲ'], rhythm: 'tresillo' },
    ],
    exercises: ['ベースを「ルートを伸ばす」で作り、キックと同じタイミング（3+3+2）に音を置き直してみましょう。', '同じ音の繰り返しで、リズムだけで聞かせるメロディーを作ってみましょう。'],
  },
  {
    id: 'edm',
    name: 'EDM',
    icon: '🎆',
    summary: 'エレクトロニック・ダンス・ミュージック。ハウス、ビッグルーム、フューチャーベースなど、電子音で作られた踊るための音楽の総称です。',
    bpm: { min: 120, max: 130, note: 'ハウス系の多くはこの範囲。ダブステップやフューチャーベースは 140〜160 前後で、半分の速さに感じるリズムを使うことがあります。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['盛り上がりに向けて緊張を高める「ビルドアップ」と、一気に解放する「ドロップ」の構成が特徴的です。'] },
      { title: 'リズムの特徴', points: ['キックを毎拍鳴らす **4つ打ち** と、拍の裏のハイハットが基本。', '2拍目と4拍目にクラップやスネアを重ねることが多いです。'] },
      { title: 'コード進行の傾向', points: ['マイナーキーの循環進行（例：Ⅰm–Ⅵ–Ⅲ–Ⅶ）や、メジャーキーの Ⅳ–Ⅴ–Ⅵm などがよく使われます。', '4〜8小節の同じ進行を繰り返し、音色や音数の変化で展開を作ります。'] },
      { title: '使用するスケールの傾向', points: ['ナチュラルマイナーやメジャースケール。リードのメロディーはペンタトニックで作られることも多いです。'] },
      { title: 'ベースラインの特徴', points: ['キックとぶつからないよう、拍の裏で鳴らすベース（オフビートベース）や、低く伸ばすサブベースがよく使われます。'] },
      { title: 'メロディーの特徴', points: ['短いフレーズの繰り返し（リフ）が中心。ドロップではシンセのリードが歌の代わりに主役になります。'] },
      { title: 'アレンジの特徴', points: ['キックが鳴るたびに他の音の音量を下げる「サイドチェイン」で、ポンピング（うねるようなノリ）を作るのが定番です。'] },
      { title: '音色の特徴', points: ['スーパーソウ（厚みのあるのこぎり波のシンセ）、プラック、パッド、強いキック。'] },
    ],
    rhythms: [
      { id: 'four', name: '4つ打ち', description: '毎拍のキック＋裏拍のハイハット＋2・4拍目のクラップ。', drums: { 36: [0, 4, 8, 12], 39: [4, 12], 46: OFF8 }, chordRhythm: 'sustain', bass: 'eighth' },
      { id: 'four-offbeat-chords', name: '4つ打ち＋裏打ちのコード', description: 'コードを裏拍で短く鳴らすと、ハウスらしいノリになります。', drums: { 36: [0, 4, 8, 12], 39: [4, 12], 42: OFF8 }, chordRhythm: 'offbeat', bass: 'octave' },
      { id: 'buildup', name: 'ビルドアップ風', description: 'スネアを細かく刻んで、盛り上がりに向かう緊張感を作る例。', drums: { 36: [0, 4, 8, 12], 38: HAT8 }, chordRhythm: 'quarter', bass: 'quarter' },
    ],
    samples: [
      { id: 'minor-loop', name: 'マイナーの循環', description: 'EDM で多用される Ⅰm–Ⅵ–Ⅲ–Ⅶ の進行。', tonic: 'F', mode: 'minor', bpm: 126, romans: ['Ⅰm', 'Ⅵ', 'Ⅲ', 'Ⅶ'], rhythm: 'four' },
      { id: 'house', name: 'ハウス風（裏打ちのコード）', description: 'メジャーキーの明るい進行を、裏打ちのコードで。', tonic: 'C', mode: 'major', bpm: 124, romans: ['Ⅵm', 'Ⅳ', 'Ⅰ', 'Ⅴ'], rhythm: 'four-offbeat-chords' },
    ],
    exercises: ['ドロップ用に、ペンタトニックの音だけで2小節のリードのフレーズを作り、繰り返してみましょう。', 'ベースを「オクターブ」にして、キックと交互に鳴る感じを確かめましょう。'],
  },
  {
    id: 'hiphop',
    name: 'HIPHOP',
    icon: '🎤',
    summary: 'ラップを中心にした音楽。ブーンバップからトラップまで、ビート（ドラム）とループするフレーズが主役です。',
    bpm: { min: 80, max: 100, note: 'ブーンバップ系の目安。トラップは 130〜150 前後で、スネアを3拍目に置いて半分の速さに感じさせることが多いです。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['ラップが主役なので、トラックは繰り返し（ループ）を基本に、言葉が聞き取りやすい作りになっています。'] },
      { title: 'リズムの特徴', points: ['ブーンバップ：重いキックと、2・4拍目の強いスネア。少しはねたノリ（スウィング）が特徴。', 'トラップ：細かく刻むハイハットと、3拍目のスネア、長く伸びる 808（低いキックベース）。'] },
      { title: 'コード進行の傾向', points: ['2〜4個のコードのループが中心。マイナーキーが多い傾向があります。', 'ソウルやジャズの影響で、m7・m9 などのセブンス系の響きもよく使われます。'] },
      { title: '使用するスケールの傾向', points: ['ナチュラルマイナー、マイナーペンタトニック、ハーモニックマイナー（ダークな雰囲気に）。'] },
      { title: 'ベースラインの特徴', points: ['キックと同じタイミングで鳴る低音。トラップでは 808 がベースの役割をします。'] },
      { title: 'メロディーの特徴', points: ['サビ（フック）は短いフレーズの繰り返し。トラックのメロディーは控えめにして、ラップの邪魔をしないのが基本です。'] },
      { title: 'アレンジの特徴', points: ['ループに、曲の場所に合わせて音を足したり抜いたりして展開を作ります。'] },
      { title: '音色の特徴', points: ['ピアノやエレピのループ、ストリングス、808、太いキック、スネア／クラップ。'] },
    ],
    rhythms: [
      { id: 'boombap', name: 'ブーンバップ', description: '重いキックと 2・4拍目のスネア。', drums: { 36: [0, 7, 10], 38: [4, 12], 42: HAT8 }, chordRhythm: 'sustain', bass: 'whole' },
      { id: 'trap', name: 'トラップ（ハーフタイム）', description: 'スネアを3拍目に置き、ハイハットを16分音符で刻む。BPM が速くても、ゆったり重く感じます。', drums: { 36: [0, 3, 10], 38: [8], 42: HAT16 }, chordRhythm: 'sustain', bass: 'whole' },
    ],
    samples: [
      { id: 'boombap-loop', name: 'ブーンバップのループ', description: 'm7 の響きを使った、ソウル風のループ。', tonic: 'D', mode: 'minor', bpm: 90, romans: ['Ⅰm7', 'Ⅳm7', 'Ⅰm7', 'Ⅳm7'], rhythm: 'boombap' },
      { id: 'trap-loop', name: 'トラップのループ', description: 'マイナーキーの暗いループ。最後に Ⅴ（ハーモニックマイナー由来）で緊張感を出します。', tonic: 'C', mode: 'minor', bpm: 140, romans: ['Ⅰm', 'Ⅵ', 'Ⅳm', 'Ⅴ'], rhythm: 'trap' },
    ],
    exercises: ['ブーンバップのループに、ラップの邪魔にならない短いピアノのフレーズを1つだけ足してみましょう。', 'トラップのサンプルで、ベースをキックと同じ位置に置き直してみましょう。'],
  },
  {
    id: 'rnb',
    name: 'R&B',
    icon: '🌙',
    summary: 'リズム・アンド・ブルース。ソウルやゴスペルの流れをくむ、なめらかな歌とおしゃれなコードが特徴の音楽です。',
    bpm: { min: 60, max: 100, note: 'スローな曲（スロウジャム）は 60〜80 前後が多い傾向があります。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['歌の表現力（細かい節回し）を聞かせる曲が多く、伴奏はそれを支える落ち着いた作りが中心です。'] },
      { title: 'リズムの特徴', points: ['少し後ろにもたれるような、ゆったりしたノリ。16分音符の細かいハイハットや、はねたリズムも使われます。'] },
      { title: 'コード進行の傾向', points: ['△7・m7・9th などのセブンス系・テンション系のコードがよく使われます。', 'Ⅱm7–Ⅴ7 や Ⅳ△7–Ⅲm7 のような、なめらかにつながる進行が多いです。'] },
      { title: '使用するスケールの傾向', points: ['メジャー／マイナーに加えて、ペンタトニックやブルーススケールでの節回し（フェイク）が特徴的です。'] },
      { title: 'ベースラインの特徴', points: ['音をなめらかにつなぐベース。休符やシンコペーションで、グルーヴ（ノリ）を作ります。'] },
      { title: 'メロディーの特徴', points: ['1つの言葉で音を細かく動かす「メリスマ」や、ブルーノートを使った歌い回しがよく聞かれます。'] },
      { title: 'アレンジの特徴', points: ['エレピとベースとドラムを土台に、パッドやコーラスで厚みを出します。'] },
      { title: '音色の特徴', points: ['エレクトリックピアノ（エレピ）、やわらかいパッド、温かいベース、スナップ（指パッチン）。'] },
    ],
    rhythms: [
      { id: 'slowjam', name: 'スロウジャム', description: 'ゆったりしたキックと、2・4拍目のスネア。', drums: { 36: [0, 10], 38: [4, 12], 42: HAT8 }, chordRhythm: 'sustain', bass: 'whole' },
      { id: 'groove16', name: '16分のグルーヴ', description: 'ハイハットを16分音符で刻み、キックをずらした細かいノリ。', drums: { 36: [0, 6, 10], 39: [4, 12], 42: HAT16 }, chordRhythm: 'quarter', bass: 'root-fifth' },
    ],
    samples: [
      { id: 'two-five', name: 'ツーファイブの循環', description: 'Ⅱm7–Ⅴ7–Ⅰ△7–Ⅵm7 の、おしゃれな循環進行。', tonic: 'Eb', mode: 'major', bpm: 72, romans: ['Ⅱm7', 'Ⅴ7', 'Ⅰ△7', 'Ⅵm7'], rhythm: 'slowjam' },
      { id: 'neo', name: 'Ⅳ△7–Ⅲm7 の流れ', description: 'Ⅳ△7–Ⅲm7–Ⅱm7–Ⅰ△7 と下がっていく、なめらかな進行。', tonic: 'F', mode: 'major', bpm: 84, romans: ['Ⅳ△7', 'Ⅲm7', 'Ⅱm7', 'Ⅰ△7'], rhythm: 'groove16' },
    ],
    exercises: ['サンプルの進行で、コードトーン（色分けで赤い音）を中心に、ゆったりしたメロディーを作りましょう。', 'メロディーの一部にテンションの音（黄色）を入れて、響きの変化を聴いてみましょう。'],
  },
  {
    id: 'pops',
    name: 'ポップス',
    icon: '🌟',
    summary: '多くの人に親しまれる歌もの音楽。J-POP では、Aメロ・Bメロ・サビの構成と、覚えやすいメロディーが重視されます。',
    bpm: { min: 70, max: 180, note: 'バラードからアップテンポまで幅が広いジャンルです。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['歌（メロディー）が主役。J-POP では「Aメロ → Bメロ → サビ」の構成がよく使われます。'] },
      { title: 'リズムの特徴', points: ['8ビート（ハイハットを8分音符で刻み、2・4拍目にスネア）が基本。速い曲では16ビートや4つ打ちも使われます。'] },
      { title: 'コード進行の傾向', points: ['王道進行（Ⅳ–Ⅴ–Ⅲm–Ⅵm）、カノン進行、小室進行、Ⅰ–Ⅴ–Ⅵm–Ⅳ などの定番進行がよく使われます。', 'サビの前に転調したり、借用コードで切なさを加えたりする曲もあります。'] },
      { title: '使用するスケールの傾向', points: ['メジャースケールが中心。ヨナ抜き（メジャーペンタトニック）のメロディーも多く見られます。'] },
      { title: 'ベースラインの特徴', points: ['ルート音を8分音符で刻む形が基本。サビでオクターブや経過音を加えて動きを出します。'] },
      { title: 'メロディーの特徴', points: ['サビは音域が高く、同じフレーズを繰り返して覚えやすくするのが定番です。'] },
      { title: 'アレンジの特徴', points: ['Aメロは音数少なめ、サビで楽器を増やして盛り上げるなど、場所ごとに厚みを変えます。'] },
      { title: '音色の特徴', points: ['ピアノ、アコースティック／エレキギター、ストリングス、シンセなど、曲に合わせて幅広く使われます。'] },
    ],
    rhythms: [
      { id: 'eight', name: '8ビート', description: 'ポップスの基本のリズム。', drums: { 36: [0, 8, 10], 38: [4, 12], 42: HAT8 }, chordRhythm: 'quarter', bass: 'eighth' },
      { id: 'ballad', name: 'バラード', description: 'コードを伸ばし、ドラムを控えめにした落ち着いたリズム。', drums: { 36: [0, 8], 38: [12], 42: [0, 4, 8, 12] }, chordRhythm: 'sustain', bass: 'whole' },
    ],
    samples: [
      { id: 'oudou', name: '王道進行', description: 'J-POP のサビで定番の進行。', tonic: 'C', mode: 'major', bpm: 128, romans: ['Ⅳ△7', 'Ⅴ7', 'Ⅲm7', 'Ⅵm'], rhythm: 'eight' },
      { id: 'canon', name: 'カノン進行（バラード）', description: '感動的な雰囲気のカノン進行を、ゆったりと。', tonic: 'D', mode: 'major', bpm: 76, romans: ['Ⅰ', 'Ⅴ', 'Ⅵm', 'Ⅲm', 'Ⅳ', 'Ⅰ', 'Ⅳ', 'Ⅴ'], rhythm: 'ballad' },
    ],
    exercises: ['王道進行のサンプルで、サビ用の覚えやすいメロディー（2小節のフレーズ×2）を作りましょう。', '同じメロディーを、バラードのリズムでも鳴らして印象の違いを確かめましょう。'],
  },
  {
    id: 'rock',
    name: 'ロック',
    icon: '🎸',
    summary: 'エレキギター・ベース・ドラムを中心にした、力強いバンドサウンドの音楽。',
    bpm: { min: 100, max: 180, note: 'ミドルテンポからパンクのような速い曲まで幅があります。' },
    sections: [
      { title: 'ジャンルの特徴', points: ['歪ませた（ディストーション）エレキギターの力強いサウンドが特徴です。'] },
      { title: 'リズムの特徴', points: ['8ビートが基本。キックとスネアをはっきり鳴らし、ドラムが曲を引っぱります。'] },
      { title: 'コード進行の傾向', points: ['Ⅰ–Ⅳ–Ⅴ のシンプルな進行や、♭Ⅶ を使った進行（例：Ⅰ–♭Ⅶ–Ⅳ）がよく使われます。', 'ルートと5度だけの **パワーコード** で弾くことが多く、明るい・暗いがはっきりしない力強い響きになります。'] },
      { title: '使用するスケールの傾向', points: ['マイナーペンタトニックやブルーススケールでのギターリフ・ソロが定番です。'] },
      { title: 'ベースラインの特徴', points: ['ルート音を8分音符で刻み、ギターと一緒に曲の勢いを作ります。'] },
      { title: 'メロディーの特徴', points: ['シャウト（叫ぶような歌い方）や、ペンタトニックを使った力強いメロディー。'] },
      { title: 'アレンジの特徴', points: ['ギター・ベース・ドラムの3つが土台。ギターリフ（繰り返すフレーズ）が曲の顔になることもあります。'] },
      { title: '音色の特徴', points: ['歪んだエレキギター、ベース、生ドラム、ときにオルガンやピアノ。'] },
    ],
    rhythms: [
      { id: 'eight', name: '8ビート', description: 'ロックの基本のリズム。', drums: { 36: [0, 8, 10], 38: [4, 12], 42: HAT8 }, chordRhythm: 'quarter', bass: 'eighth' },
      { id: 'punk', name: '速い8ビート（スネア多め）', description: 'スネアを増やして勢いを出したリズム。', drums: { 36: [0, 4, 8, 12], 38: [2, 6, 10, 14], 42: HAT8 }, chordRhythm: 'quarter', bass: 'eighth' },
    ],
    samples: [
      { id: 'one-four-five', name: 'Ⅰ–Ⅳ–Ⅴ', description: 'ロックの基本の3コード。', tonic: 'E', mode: 'major', bpm: 132, romans: ['Ⅰ', 'Ⅳ', 'Ⅴ', 'Ⅳ'], rhythm: 'eight' },
      { id: 'flat-seven', name: 'Ⅰ–♭Ⅶ–Ⅳ', description: '♭Ⅶ（同主調からの借用）を使った、骨太なロックの進行。', tonic: 'A', mode: 'major', bpm: 120, romans: ['Ⅰ', '♭Ⅶ', 'Ⅳ', 'Ⅰ'], rhythm: 'eight' },
    ],
    exercises: ['Ⅰ–♭Ⅶ–Ⅳ のサンプルで、マイナーペンタトニックの音だけを使ってリフを作ってみましょう。', 'ベースを「8分音符でルート」のまま、オクターブ上の音を少しだけ混ぜてみましょう。'],
  },
];

export function findGenre(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}

/** 学習項目（進捗の記録に使う） */
export const GENRE_ITEMS = [
  { id: 'read', label: '特徴を読んだ' },
  { id: 'rhythm', label: 'リズムを聴き比べた' },
  { id: 'sample', label: 'サンプル進行を聴いた' },
  { id: 'compose', label: 'サンプルで作曲を始めた' },
] as const;

export type GenreItemId = (typeof GENRE_ITEMS)[number]['id'];
