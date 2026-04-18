# Changelog

## [4.5.2] - 2026-04-18

Phase 1 リファクタリング: 重複コードの共有ヘルパー抽出。

### 変更
- `simulation/helpers.ts` 新規作成: `calcAnnualPension`, `calcLifeEventExpense`, `getAccountBalance`, `assertNever` を共有ユーティリティに抽出
- `tax/engine.ts`: `calcGoldTaxableIncome()` を新規export—金の課税所得計算(50万控除+1/2課税)をDRY化
- `simulation/engine.ts`: ローカル関数を共有ヘルパーに置換、金のinline計算を`calcGoldTaxableIncome`に統一
- `prescription/engine.ts`: 同様に共有ヘルパーに置換、`getBalance`→`getAccountBalance`に統一
- 純削減: 89行

## [4.5.1] - 2026-04-18

含み益（取得費）の動的追跡を実装。特定口座・金現物の課税精度を向上。

### 修正
- **含み益率の静的計算バグ**: `tokuteiGainRatio` / `goldGainRatio` がシミュレーション全期間で初期値固定だった問題を修正
- **取得費（costBasis）動的追跡**: 特定口座・金現物の取得費を年次で追跡し、含み益率を動的に算出
  - 積立: 新規資金をcostBasisに加算（含み益0%）
  - リターン: costBasis不変（含み益が自然に上昇）
  - 取り崩し: costBasisを按分で減少
  - リバランス: 売却時は按分減少、購入時は加算
  - 退職金: 税引後手取りを全額costBasisに加算
- **処方箋エンジン同期**: `runTrialLite` にも同様のcostBasis追跡を適用

### テスト
- costBasis追跡のテスト8件追加（リターン・積立・含み損・金口座・リバランス・退職金・赤字取崩）
- テスト総数: 240 → 248

## [4.5.0] - 2026-04-17

UI刷新 + 計算根拠更新 + iDeCo税バグ修正。

### 追加
- **はじめにページ**: ツールの背景・使い方ガイドを5ステップのチュートリアル形式で提供 (`guide-page.tsx`)
- **アセットアロケーションバー**: 保有資産・目標配分の両方に色分け横棒グラフ + 凡例を表示
- **目標アロケーションの合成リターン/リスク/分散効果**: 保有ポートフォリオと同じパターンで表示
- **目標アロケーションに現金追加**: 目標配分・最適化の両方で現金を選択可能に
- **結果画面のシナリオ保存ボタン**: What-if調整後のパラメータをそのまま保存可能
- **処方箋の目標自動引き上げ**: 成功率90%以上でも「さらに高めるには」の処方箋が常に表示される
- **65歳未満の公的年金等控除テーブル**: 計算根拠書sec-4に追加

### 修正
- **iDeCo取り崩しの住民税10%欠落**: `calcWithdrawalTax("ideco")` が所得税のみで住民税を計算していなかったバグを修正
- **金現物リバランス税率の誤記**: 計算根拠書sec-15の「×20.315%」→「累進課税」に修正
- **フロー図の「×インフレ」誤表現**: sec-12の「実質リターン方式」を正確に記載
- **取り崩し順序の説明不足**: sec-7に「cash末尾固定 + 全順列評価」の最適化ロジックを追記
- **配偶者の費用分担説明**: sec-12のPhase 4→Phase 5へ正確化
- **ポートフォリオオプティマイザーのボタン配置**: 3ボタン混在→2段構成に整理

### 削除
- **クイックスタートカード**: 基本情報カードに「すぐにシミュレーション」ボタンを統合
- **テンプレートセレクター**: 入力画面から削除
- **結果画面のアセットアロケーション最適化**: 入力画面と重複、処方箋のアロケーション軸が代替

### 変更
- **入力画面UI刷新**: 折りたたみセクションをCollapsibleCardに統一、リセットボタンをテキストリンクに降格
- **取り崩し戦略セクション**: リバランス有効時は非表示（順序の影響がリバランスで打ち消されるため）
- **テスト**: wizard.test.tsxを4件書き直し、iDeCo税テスト追加

## [4.4.0] - 2026-04-17

処方箋エンジンv5: 壊れたinvestment軸を廃止し、income軸（年収増加）とallocation軸（アセットアロケーション最適化）に差し替え。

### 追加
- **income軸**: `annualSalary`の二分探索で「年収を+X万円にする」処方箋を生成
- **allocation軸**: 効率的フロンティアを走査し「リスクをX%→Y%に調整」処方箋を生成、「この配分を適用」ボタン付き
- **フロンティア事前計算**: Results画面で`optimizePortfolio`結果をキャッシュし処方箋に流す
- **自動展開**: 成功率90%未満時に処方箋セクションを自動で開く
- **アクセントボーダー**: 最高インパクトの処方箋に`border-primary`を適用
- **テスト+14**: income軸4テスト + allocation軸4テスト + investment削除確認 + その他5テスト

### 削除
- **investment軸**: NISA残高を仮想的に嵩上げする壊れた軸を完全削除

### 変更
- **PrescriptionAxis型**: `"investment"` → `"income" | "allocation"`
- **generatePrescriptions**: 第4引数に`frontier?: FrontierPoint[]`追加
- **Worker/SimulationWorker**: `prescribe()`に`frontier`引数追加
- **アイコン**: income=Banknote, allocation=PieChart (lucide-react)
- **セクション説明**: 「3軸提案」→「4軸提案」

## [4.3.2] - 2026-04-16

API面積縮小: 旧API一掃 + FormState v5一本化 + QA品質改善。

### 削除
- **calcPensionTax / calcSideIncomeTax**: 完全削除（calcComprehensiveTaxに統合済み）
- **FormStateマイグレーションチェーン**: migrateV2toV3/V3toV4/V4toV5を全削除、v5のみ受付
- **税エンジンexport 20→15**: calcPensionTax・calcSideIncomeTax削除

### 変更
- **prescription/engine.ts**: calcPensionTax+calcSideIncomeTax → calcComprehensiveTaxに統一、金のotherComprehensiveIncomeも渡す
- **methodology/pension.tsx**: calcPensionTax → calcPublicPensionDeduction+calcComprehensiveTax
- **methodology/side-income.tsx**: calcSideIncomeTax → calcComprehensiveTax
- **url-share.ts**: FORM_SCHEMA_VERSION 3→5に統一
- **loadForm/importFormFromJSON**: v5のみ受付、v2/v3/v4はnull返却
- **simulation-flow.tsx**: Phase 3説明を総合課税統合に更新

### 追加
- **url-shareテスト**: v5フィールド（targetAllocation+rebalanceEnabled）ラウンドトリップ
- **form-stateテスト**: v5以外のJSONインポートがnullを返す検証

## [4.3.1] - 2026-04-16

金現物の総合課税修正 + 年金・副収入の総合課税統合。

### 追加
- **calcComprehensiveTax**: 年金雑所得+副収入を合算し基礎控除1回のみ適用する総合課税関数
- **テスト+8**: 金の累進課税・年金合算・リバランス累進・後方互換・総合課税統合

### 修正
- **金リバランスの一律20.315%→累進税率**: `taxableGain * 0.20315` → `calcGoldWithdrawalTax(amount, ratio, comprehensiveIncome)` で総合課税の累進税率を適用
- **金取り崩しのotherIncome=0固定→年金・副収入と合算**: `calcWithdrawalTax` に `otherComprehensiveIncome` 引数追加、シミュレーションエンジンから年金雑所得+副収入を渡す
- **基礎控除の複数回適用→年1回**: Phase 3を書き換え、`calcPensionTax`+`calcSideIncomeTax`個別呼び出し→`calcComprehensiveTax`合算に統合
- **同一年の金取崩+リバランスで累進税率が正しく統合**: Phase 4の金取崩課税所得をcomprehensiveIncomeに累積

## [4.3.0] - 2026-04-16

目標アセットアロケーション + リバランスUI + エンジン修正。

### 追加
- **目標アセットアロケーション**: 資産クラスレベルの目標配分を入力、リバランストグルで有効化
- **TargetAllocation型**: `{ assetClass, weight }` 配列で目標配分を表現
- **目標→口座ウェイト変換**: `deriveTargetAccountWeights()` 現在保有の口座内訳比率ベースで分配
- **口座別リターン導出**: 目標配分から口座ごとの期待リターン・リスクを自動計算
- **ポートフォリオ最適化「目標に設定」ボタン**: フロンティア推薦配分をtargetAllocationに直接適用
- **計算根拠書リバランスセクション**: 3セクション追加（口座別リターン・積立リバランス・退職後リバランス）
- **FormState v5**: `targetAllocation`, `rebalanceEnabled` フィールド追加 + v4→v5マイグレーション
- **テスト+23**: 目標アロケーション変換・リバランス税務・後方互換・iDeCoロック等

### 修正
- **Stage 3リバランス全面書き直し**: トランザクション方式（売却→課税→proceedsプール→不足口座充填→cash残余吸収）に変更
- **cashリバランス対応**: cash過剰時の売却→投資口座への振り分けを追加
- **portfolioReturn加重平均化**: 口座残高ベースの加重平均に変更（診断精度向上）
- **deterministic最適化**: accountAllocationsのstdDevも中央値リターン+σ=0に補正
- **importFormFromJSON**: targetAllocationバリデーション追加（配列長上限20、weight 0-1クランプ）
- **フォールバック口座統一**: deriveTargetAccountAllocationsの未保有資産クラスマッピングをaccountWeightsベースに統一

## [4.0.2] - 2026-04-15

口座別リターン + リバランスシミュレーション。

### 追加
- **口座別リターン（Stage 1）**: 各口座の資産クラス構成から個別の期待リターン・リスクを導出、口座ごとに異なるリターンを適用
- **積立リバランス（Stage 2）**: 退職前の余剰積立時、目標ウェイトに対して不足口座に優先配分
- **退職後リバランス（Stage 3）**: 乖離閾値(5%)超過時に売買実行、特定口座売却益課税(20.315%)反映
- **SimulationInput拡張**: `accountAllocations`, `RebalanceConfig` 型追加
- **formToSimulationInput拡張**: 口座別アロケーション自動導出、初期比率から目標ウェイト自動設定

### 変更
- **engine.tsポートフォリオリターンフェーズ**: 口座別リターン生成、後方互換あり（accountAllocations未設定時は全口座同一）
- **engine.ts余剰積立フェーズ**: リバランス有効時は目標ウェイトベースの配分
- **engine.tsリバランスフェーズ新設**: 退職後年次ループにリバランスステップ追加

## [4.0.1] - 2026-04-15

入力画面縮小 + 結果画饢1カラム化 + iDeCo年齢制約 + ボラティリティドラッグ修正。

### 追加
- **iDeCo60歳未満取り崩し制約**: 取り崩しフェーズ + 赤字取り崩しフェーズでage<60ならidecoをスキップ
- **取り崩し戦略比較グラフ**: Recharts LineChartで最適/現在/最悪の資産推移を重ね描き
- **前回結果差分**: 成功率カードに「前回比 +N%」表示（localStorage保存）
- **最優先アクション**: 処方箋top1を1軍に表示、クリックで処方箋へスムーズスクロール
- **適用バッジ**: 取り崩し/ポートフォリオ適用後に+N%バッジ(2秒フェードアウト)

### 変更
- **入力画面縮小**: QuickStart・QuickPreview廃止、テンプレート・シナリオを折りたたみに降格
- **結果画饢1カラム化**: 2カラム(lg:grid-cols-2)→全セクション縦並び
- **折りたたみデフォルト閉**: 年金・ライフイベントのopen属性を削除
- **ボラティリティドラッグ反映**: deterministic最適化で中央値リターン(exp(log(1+r)-σ²/2)-1)を使用
- **再計算リファクタ**: 3箇所の重複コードをtriggerRecalc()に共通化
- **ロードマップ縮小**: Phase 7削除、Phase 6を税制JSON更新のみ、メンテナンスモード宣言

## [4.0.0] - 2026-04-15

結果画面の情報階層化 + 取り崩し最適化UI接続 + FormState v4。

### 追加
- **取り崩し最適化UI** (`withdrawal-card.tsx`): 全パターン(最大24通り)の最適順序・改善額・全順位表を表示、ワンクリック適用
- **決定論的最適化モード**: `optimizeWithdrawalOrder(input, { deterministic: true })` — stdDev=0, numTrials=1 で<50msの同期計算。配偶者のstdDevも制御
- **FormState v4**: `withdrawalOrder?: TaxCategory[]` 追加。スキーマv3→v4マイグレーション。シナリオ保存・URL共有に自動反映
- **テンプレート適用バナー**: テンプレート選択時に3秒間のフィードバックバナー表示

### 変更
- **結果画面の情報階層化**: 1軍(成功率・チャート・最悪ケース)は常時表示、2軍(処方箋・取り崩し最適化・税内訳)は`<details>`折りたたみ
- **取り崩し順序のハードコード廃止**: 結果画面の固定表示を最適化エンジン接続に置換
- **cash末尾固定**: 取り崩し順列からcashを除外し末尾固定(5!=120→4!=24通りに抑制)
- **取り崩し最適化テスト**: 6テスト→13テスト(deterministic, cash除外, 0/1口座エッジケース)

## [3.0.0] - 2026-04-14

Phase 5: テンプレートシナリオ + UX品質 + 税制年度切替基盤。

### 追加
- **テンプレートセレクター**: 5種のプリセット（転職/住宅購入/教育費/早期退職/年金繰下げ）
  - QuickStartとフルフォームの間に配置、カード選択で即座にFormStateにdelta適用
  - lifeEventsはユーザー年齢に相対化（35歳基準）、endAge上限クランプ付き
  - 選択後、関連セクション（年金・退職金/ライフイベント）が自動展開
- **チャートデータテーブル代替**: 資産推移チャート直下に折りたたみテーブル
  - 年齢×p5/p25/中央値/p75/p95の5列、5年間隔+最終年
  - `<caption class="sr-only">` でスクリーンリーダー対応
- **税制年度切替基盤**: `src/config/tax-config-index.ts`
  - `getTaxConfig(year)` で年度別設定取得、未知年度はLATEST_YEARにフォールバック
  - tax/engine.tsのimport元を直接JSON→tax-config-indexに変更

### 改善
- **処方箋スケルトンUI**: 計算中に3行パルスアニメーションのスケルトン表示
- **タッチターゲット44px**: ライフイベント・ポートフォリオ削除ボタン(`min-h/w-[44px]`)、テーマトグル(`w-11 h-11`)

### テスト
- テンプレートシナリオ: 10テスト（全数バリデーション、年齢相対化、追記マージ、上限クランプ、重複ID、pension/endAge）
- 税制年度切替: 4テスト（年度指定、デフォルト、フォールバック、LATEST_YEAR）
- 合計: 180テスト (+14)

## [2.0.1] - 2026-04-14

安定版ポリシー採用。エコシステム未追従のメジャーバンプをロールバックし、開発ルールを明文化。

### 変更
- **TypeScript 6→5.9.3**: TS6のCSS import型宣言要件(`types: ["vite/client"]`)が不要に。最新機能は未使用
- **ESLint 10→9.39.4**: flat config APIの`defineConfig`/`globalIgnores`が不要に。プラグインエコシステムが安定
- **eslint-plugin-react-hooks canary→7.0.1**: ESLint 9対応安定版。React Compiler向け実験的ルールを回避
- **@types/node 25→22**: CI Node.js 22と一致させる
- **vite-tsconfig-paths 6→5**: TS5対応安定版

### 追加
- **Dependabotメジャーバンプ制御**: typescript/eslint/vite/@types/nodeのメジャーバンプをignore
- **依存関係ポリシー**: DESIGN.mdにバージョン選定基準・Dependabotルール・安定版ベースラインを明文化
- **CI lintステップ**: deploy.ymlのtestジョブに`npm run lint`追加

### 修正
- **react-dom バージョン不整合**: `19.2.5`(pin)→`^19.2.5`(caret)に統一。`npm update`時のpeer dep不整合を防止
- **ChunkErrorBoundary**: React.lazy読み込み失敗時の白画面を防止するErrorBoundary追加
- **spouse.portfolio長さガード**: importFormFromJSONに配列長20件上限を追加
- **未使用import整理**: 12ファイルの未使用import/変数を削除（ESLint TSパーサー導入で初めて検出）

## [2.0.0] - 2026-04-14

Phase 4: パフォーマンス・テスト。コード分割で初期ロード半減、E2Eテスト導入。

### 追加
- **React.lazyコード分割**: Results/ScenarioCompare/MethodologyPageを遅延ロード
  - 初期バンドル: 752KB → 368KB (gzip 227KB → 118KB) — **49%削減**
  - recharts(372KB)は結果画面遷移時にオンデマンドロード
- **E2Eテスト**: Playwright + Chromium。4テストケース
  - QuickStart→結果画面→チャート・処方箋表示
  - 計算根拠ページ遷移・戻る
  - 共有URLボタン存在確認
  - ダークモード切替
- **CI E2Eゲート**: deploy.ymlにPlaywrightテスト追加（デプロイ前に実行）

## [1.9.0] - 2026-04-14

Phase 3: 品質・堅牢性。レスポンシブ対応、a11y強化、ダイアログa11y。

### 改善
- **レスポンシブ対応**: ポートフォリオ行・ライフイベント行がsmブレークポイントでスタック→横並びに切替
- **チャート高さレスポンシブ**: モバイル250px / デスクトップ350px
- **シナリオ比較グリッド**: CSS Gridのsm/lgブレークポイント対応（1→２→３カラム）
- **ポートフォリオ最適化ダイアログ**: role="dialog", aria-modal, Escapeキー対応, フォーカス管理
- **テーマトグル**: Sun/Moonアイコンにaria-hidden追加

## [1.8.0] - 2026-04-14

Phase 2: Time to Value 革命。クイックスタートで初見離脱率を削減、結果ページをアクション優先に再構成。

### 追加
- **クイックスタート**: 3項目（年齢・年収・資産総額）だけで即座にシミュレーション開始
  - 省略フィールドはDEFAULT_FORMの合理的デフォルトで補完
  - 「詳しく設定する」リンクでフルフォームに展開
  - QuickStartの入力値はフルフォームに自動反映

### 変更
- **結果ページレイアウト再構成**: 処方箋カードをフル幅KPI直下に昇格（アクション優先）
  - 旧: 左カラム[チャート+What-if] / 右カラム[処方箋+診断+税金+取り崩し]
  - 新: KPI → 処方箋(フル幅) → 左[チャート+What-if] / 右[診断+税金+取り崩し]

## [1.7.0] - 2026-04-14

Phase 1: 共有URL（バイラル装置）。シミュレーション結果をURLで共有可能に。

### 追加
- **共有URL生成**: 結果画面の「このプランを共有」ボタンでFormStateをDeflateRaw+Base64url圧縮し、URLフラグメント(`#s=`)にエンコード
- **共有URL復元**: URLを開くと自動でシミュレーション実行、結果画面を即表示（「共有されたプランを表示中」バナー付き）
- **Web Share API対応**: モバイルではネイティブ共有ダイアログ、デスクトップではclipboardコピー

### セキュリティ
- 共有データは`importFormFromJSON`の既存バリデーション+マイグレーションを通過
- portfolio行数8件、lifeEvents.label 50文字、numTrials 1000に制限
- ハッシュ読み取り後に`history.replaceState`でクリア（リロードループ防止）
- 共有復元時はlocalStorageに保存しない（受信者のデータ上書き防止）

### テスト
- `url-share.test.ts` 15テスト追加（ラウンドトリップ、不正入力、URL長制限）
- 合計: 162テスト

## [1.6.1] - 2026-04-14

a11y・コード品質改善パッチ。

### アクセシビリティ
- **`<nav>` ランドマーク追加**: ヘッダーナビゲーションを `<nav aria-label="メインナビゲーション">` でマークアップ
- **Skip-to-content リンク追加**: キーボードナビゲーションでメインコンテンツへ直接ジャンプ
- **チャート aria-label**: 資産推移チャートに `role="img"` + 説明的 aria-label 付与
- **削除ボタンアイコン統一**: 生テキスト「✕」を lucide-react `X` アイコンに置換（3箇所）
- **ポートフォリオ最適化モーダル**: 閉じるボタンに `aria-label="閉じる"` 追加

### リファクタリング
- **`formatManYen` 一元化**: 4箇所の重複定義を `lib/utils.ts` に統合。億円単位ハンドリング + オプショナル「円」接尾辞をサポート

## [1.6.0] - 2026-04-14

3フェーズレビュー（CEO/デザイン/エンジニアリング）を統合し、UI品質・アクセシビリティ・法的安全性を改善。

### 改善
- **免責条項強化**: 「投資助言・税務助言ではない」「過去データに基づく確率的推計」「専門家に相談」の3文をフッターに追加
- **結果ページ情報優先度修正**: 処方箋カードを右カラム最上部に昇格、最悪ケース診断書を処方箋直下に移動（ページ最下部から昇格）
- **処方箋カード色統一**: ハードコードTailwind色をセマンティックトークン(`--success`/`--warning`/`--danger`)に統一
- **チャート凡例視認性改善**: 90%信頼区間の色見本 opacity 0.1→0.3、50%信頼区間 0.2→0.5

### アクセシビリティ
- **OKLchコントラスト修正**: `--success`/`--warning`/`--danger`のライトモード値をWCAG AA 4.5:1以上に調整

### 追加
- **404.html SPA fallback**: GitHub Pagesで直リンクアクセス時に`index.html`へリダイレクト

## [1.5.2] - 2026-04-14

CSP をビルド時のみ注入に変更。dev サーバーの HMR 破壊を修正し、defense-in-depth ディレクティブを追加。

### 修正
- **CSP meta タグ → Vite プラグイン移行**: `index.html` の静的 CSP が Vite dev サーバーの HMR (React Fast Refresh) を破壊していた問題を修正。本番ビルド時のみ `transformIndexHtml` で CSP を注入する `cspPlugin()` に移行

### セキュリティ
- **defense-in-depth ディレクティブ追加**: `object-src 'none'` (プラグイン攻撃防止)、`base-uri 'self'` (base タグインジェクション防止)、`form-action 'self'` (フォーム送信先制限)

## [1.5.1] - 2026-04-13

OGP/Twitter Card + favicon 追加。共有時のリンクプレビューを有効化。

### 追加
- **OGP メタタグ**: og:title, og:description, og:image, og:url, og:locale, og:site_name
- **Twitter Card**: summary_large_image 対応
- **OGP画像**: 1200×630 ダークテーマ（炎アイコン、機能ピル、タグライン）
- **favicon**: SVG + 32px PNG + 180px Apple Touch Icon
- **theme-color**: ダークスレートブルー (#0f172a)
- **description更新**: 処方箋エンジンの説明を追加

## [1.5.0] - 2026-04-13

デザイン品質向上 + 入力バリデーション強化。

### 改善
- **emoji→lucide-react SVG**: ヘッダー火炉アイコン、テーマトグル(Sun/Moon)、処方箋アイコン(Wallet/CalendarClock/TrendingUp)、診断書アイコンを環境非依存のSVGに置換
- **スティッキーCTAボタン**: 「シミュレーション開始」ボタンを画面下部に固定表示(sticky bottom + backdrop-blur)
- **a11y**: テーマトグルにaria-label追加、チェブロンにaria-hidden追加、枯渇・暴落マーカーにaria-label追加

### セキュリティ
- **年齢整合性ガード**: retirementAge > currentAge、endAge > retirementAge を`formToSimulationInput`で強制
- **年齢上限120歳**: endAge/retirementAgeに上限キャップ追加(DoS防止)
- **numTrials上限**: 10,000回にキャップ(JSON import経由の過大値防止)
- **pension/sideIncome/lifeEventsサニタイズ**: 全拡張フィールドにsafeNum適用(負値・NaN防御)
- **配偶者年齢ガード**: spouseFormToInputに同等の年齢整合性ガード適用
- **Worker cancelデッドコード除去**: 未実装のcancel型をWorkerMessageから削除

### テスト
- 年齢整合性テスト3件 + numTrials上限テスト + 年齢上限テスト2件 = **6テスト追加** (147テスト)

## [1.4.0] - 2026-04-12

最悪ケース診断書（p5シナリオの失敗原因分析）を追加。

### 追加
- **最悪ケース診断書カード**: 結果画面の下部にp5（下位5%）シナリオの診断を表示
- **失敗原因の自動分類**: 暴落型 / 資金不足型 / ライフイベント集中型 / 長寿リスク型 の4分類
- **p5 vs 中央値 対比テーブル**: 重要年（退職年・転換点・5年刻み・枯渇年）を間引き表示
- **転換点ハイライト**: 暴落年は赤背景、枯渇年は太字赤、転換点は警告色
- **診断サマリ**: 原因アイコン + 自然言語での要約テキスト
- **diagnosis.ts**: `findP5Trial()` + `diagnoseFailure()` の診断エンジン
- **diagnosis.test.ts**: 7テスト（各分類 + findP5Trial）

## [1.3.0] - 2026-04-12

計算根拠書ページ（12セクション）を追加。全ルールを具体例付きで解説。

### 追加
- **計算根拠書ページ**: ヘッダー「計算根拠」リンクから遷移する静的解説ページ
- **3グループ構成**: 収入と税金(sec1-5) / 資産の取り崩し(sec6-8) / シミュレーションの仕組み(sec9-12)
- **動的計算例**: 税エンジン関数を呼び出し、JSONの値変更に自動追従
- **スティッキー目次**: IntersectionObserverで現在セクションをハイライト
- **スクロールプログレスバー**: ページ上部に読み進み状況を表示
- **全セクションに出典URL**: 国税庁・厚労省・金融庁等の公式リンク
- **10×10相関行列テーブル**: 横スクロール対応
- **7フェーズフロー図**: 年次シミュレーションの全体像をASCII図で可視化

## [1.2.0] - 2026-04-12

現金区分追加・配偶者非表示・Y軸表示修正。

### 追加
- **現金・預金(cash)区分**: 5番目のTaxCategoryとして追加。取り崩し税0%、リターン0%（元本維持）
- 資産クラス「現金・預金」選択時に税区分を自動ロック

### 変更
- 取り崩し順序: 現金 → NISA → 特定口座 → 金現物 → iDeCo
- 配偶者セクションをコメントアウトで非表示（将来復活用に保持）

### 修正
- Y軸 `formatManYen` を億表記対応 (10,000万→1億) + `width:80` でラベル切れ解消

## [1.1.1] - 2026-04-12

デザインレビュー4改訂: アクセシビリティ・レスポンシブ・一貫性・視覚階層を改善。

### 改善
- **D6 一貫性**: 成功率の色を `--success/--warning/--danger` CSSトークンに統一 (oklch, light/dark対応)
- **D4 アクセシビリティ**: ✅⚠️❌ アイコン二重インジケーター、`role="alert" aria-live="polite"`、CardTitle を `<h2>` に変更
- **D2 視覚階層**: 年金・イベント・配偶者・詳細設定を `<details>` 折りたたみ化、入力済みバッジ表示
- **D5 レスポンシブ**: Results画面を `lg:grid-cols-2` 2カラム化、全コンテナを `max-w-6xl` に拡大

## [1.1.0] - 2026-04-12

CEOレビュー3推奨を実装。wizard分割・プログレッシブUX・コードレビュー修正。

### 追加
- **wizard分割**: 975行のモノリスを 9 サブコンポーネント + 90行オーケストレーターにリファクタ
- **QuickPreview**: 入力中に概算成功率をリアルタイム表示 (100回試行, 800msデバウンス, Web Workerオフスレッド)
- `PortfolioEntry.id` / `LifeEvent.id`: Reactリストの安定キー用一意識別子
- `FormState.spouseEnabled`: 配偶者トグルOFF時もデータ保持

### 修正
- QuickPreview: `formFingerprint` が `lifeEvents`/`sideIncome`/`inflationRate` 等を未追跡 → `JSON.stringify(form)` で全フィールド網羅
- QuickPreview: ランダムseedで同一入力でも±10%ブレ → 固定seed=42で再現性確保
- 年齢スライダー: `currentAge` 引き上げ時に `retirementAge < currentAge` になる不正状態 → カスケードクランプ追加
- income-section: 年金フォールバック値が `kokumin: 65000` と `kokumin: 0` で不一致 → `DEFAULT_PENSION` 定数に統一

### 変更
- DESIGN.md: v0.9設計 → v1.0.0実装現状ドキュメントに書き換え

## [1.0.0] - 2026-04-12

「人生の資産設計エンジン」として再定義。年金・世帯・ポートフォリオ最適化の3フェーズを一挙実装。

### 追加（Phase 1: 収入源拡張）
- 公的年金シミュレーション: 厚生年金・国民年金、繰上げ/繰下げ (0.4%/月 減額・0.7%/月 増額)
- 退職金: 退職所得控除 (勤続年数ベース) + 分離課税計算
- 副収入: 退職後のフリーランス・不労所得シミュレーション
- ライフイベント: 年齢指定の一時支出 (住宅購入、教育費等)
- NISA枠管理: 年間・生涯投資枠の積立上限シミュレーション
- 税計算エンジン: `calcPublicPensionDeduction`, `calcPensionTax`, `calcRetirementBonusNet`, `calcSideIncomeTax`
- tax-config-2026.json: 公的年金等控除テーブル (65歳未満/65歳以上)

### 追加（Phase 2: 世帯シミュレーション）
- 配偶者サポート: 年齢差・退職時期差に対応した2人分の同時シミュレーション
- 世帯収支: 在職者の費用負担、退職者の年金・副収入を統合
- 取り崩し順序: Primary口座 → Spouse口座の順で最適化
- 配偶者UI: ポートフォリオ管理、年金、退職金入力

### 追加（Phase 3: ポートフォリオ最適化）
- 効率的フロンティア: モンテカルロ法 (10,000サンプル) で近似
- リスク許容度スライダー: 保守的 → 攻撃的の4段階
- SVGフロンティアチャート + 推奨配分バーグラフ
- ワンクリック適用: 最適配分をポートフォリオに即反映

### 修正
- 世帯シミュレーション: 在職者の所得が二重計上されるバグを修正
- 退職前ライフイベント: 手取りを超える支出が消失するバグを修正
- 処方箋エンジン: 年金・退職金・副収入・ライフイベントを反映 (runTrialLite)
- 社会保険料: 重複計算を変数キャッシュで解消
- optimizer: フロンティア計算とレコメンド選択を分離しスライダー操作時の再計算を最適化

### 変更
- DESIGN.md: 「人生の資産設計エンジン（日本版）」として全面書き直し
- テスト: 94 → 134 (+40) — 年金・退職金・副収入・世帯・最適化・回帰テスト

## [0.8.0] - 2026-04-12

### 追加
- シナリオ保存: 名前付きパラメータセットを複数保存・切替・上書き・削除
- シナリオ比較画面: 保存済みシナリオを並列シミュレーション実行し、成功確率・退職年齢・生活費・最終資産を横並び比較
- JSONエクスポート: 現在の入力をファイルとしてダウンロード
- JSONインポート: エクスポートファイルを読み込み復元（バリデーション付き）
- テスト: 86 → 94 (+8) — シナリオCRUD 4件、エクスポート/インポート 4件
- README.md: create-next-appボイラープレートをプロジェクト説明に書き直し

## [0.7.0] - 2026-04-12

### 変更
- **Next.js 16 → Vite 6 移行**: Turbopack devサーバーのメモリ爆発（~20GB）を解消
- devサーバー起動: クラッシュ → 389ms
- `"use client"` ディレクティブを全9ファイルから除去
- エントリポイント: `src/app/page.tsx` → `src/App.tsx` + `src/main.tsx` + `index.html`
- eslint: `eslint-config-next` 除去
- tsconfig: Next.js plugin・.next パス除去
- AGENTS.md: Next.js → Vite SPA 用に更新

### 削除
- `next`, `eslint-config-next` 依存パッケージ
- `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

### 追加
- `vite`, `@vitejs/plugin-react`, `vite-tsconfig-paths` 依存パッケージ
- `vite.config.ts` (Worker内パスエイリアス対応含む)
- `DESIGN-vite-migration.md` デザインドキュメント

### 維持
- 計算エンジン (`src/lib/**`): 変更ゼロ
- テスト: 86/86 全パス（変更ゼロ）
- UIコンポーネント: `"use client"` 除去のみ

## [0.6.0] - 2026-04-12

### 追加
- 実質リターン補正: シミュレーションに想定インフレ率（デフォルト2%）を導入
- wizard: 詳細設定に「想定インフレ率」スライダー（0〜5%、ステップ0.1%）
- results: What-Ifスライダーにインフレ率追加 + 「インフレ率 X% 考慮済み」バッジ
- FormStateスキーマバージョン v1→v2（inflationRateフィールド追加）
- テスト: 83 → 86 (+3) — インフレ率の成功率影響・名目リターン一致・変換テスト

## [0.5.2] - 2026-04-12

### 改善
- Node.jsヒープ制限 `--max-old-space-size=512` をdevスクリプトに追加
- Next.jsメモリ最適化: `workerThreads: false`, `cpus: 1`

## [0.5.1] - 2026-04-12

### 追加
- FormState永続化: 全入力をlocalStorageに自動保存・復元（500msデバウンス）
- スキーマバージョニング: FormState型変更時に古いデータを安全に破棄
- 「入力をリセット」ボタン: localStorage削除 + DEFAULT_FORMにリセット
- テスト: 78 → 83 (+5) — localStorage永続化のラウンドトリップ・バージョン不一致・不正JSON

## [0.5.0] - 2026-04-12

### 追加
- 統合資産台帳: 金現物 (gold_physical) を第4口座種別として追加
- `TaxCategory` 型システム: nisa / tokutei / ideco / gold_physical の4種別で口座を管理
- 金現物譲渡所得税計算 (`calcGoldWithdrawalTax`): 50万控除 + 1/2課税 + 総合課税
- ウィザードを4ステップ形式から1ページスクロール形式に刷新
- ポートフォリオ入力に課税種別セレクタを追加
- 資産クラス⇔課税種別のクロスバリデーション (gold↔gold_physical 連動)
- 取り崩し順序最適化が金現物口座を含む最大4!=24通りの順列を探索
- `asset-class-data.json` に金の期待リターン・リスク・相関係数を追加

### 修正
- `getActiveCategories` が初期残高0のtokuteiを除外し勤労余剰が座礁する問題を修正
- `TaxCategory` の二重定義を解消 (`portfolio/types.ts` を唯一のソースに統一)
- テスト: 71 → 78 (+7)

## [0.4.0] - 2026-04-11

### 追加
- ポートフォリオ・ブリッジ: 資産クラス別保有額から合成リターン・リスクを自動計算
- 8資産クラス + 現金の相関行列データ (GPIF基本ポートフォリオ策定資料ベース)
- ウィザード Step 3 に 2モード切替 (ポートフォリオ入力 / 手動入力)
- 分散効果のリアルタイム表示
- ポートフォリオエンジンテスト 9件、統合テスト 3件

### 修正
- 65歳以上の介護保険第1号被保険者保険料 (年¥74,700) が未計算だった問題を修正
- 60歳以上で国民年金保険料 (年¥210,120) が課金され続けていた問題を修正
- 確認画面のリスク表示がシミュレーション実行値と不整合だった問題を修正
- 「資産クラスを追加」ボタンが全クラス使用済みでも表示されていた問題を修正
- 年齢別社会保険料回帰テスト 6件追加 (30/45/59→ 60/64→65/80歳)
- テスト: 53 → 71 (+18)

## [0.3.0] - 2026-04-11

### 追加
- 処方箋エンジン（Prescription Engine）: 成功率目標に対して支出削減・退職時期・追加投資の3軸で逆算
- 税金の見える化: 退職1年目+10年目の税金ブレイクダウンカード（所得税・住民税・社保・取崩し税・実効負担率）
- `TaxBreakdown` 型: `YearResult.tax` を所得税/住民税/社保/取崩し税の内訳に拡張
- 「2026年度 税制・社会保険料 反映済み」バッジを結果画面に追加
- `runSimulationLite()`: 処方箋計算用の軽量シミュレーション（成功率のみ返却）
- Worker に `prescribe` メッセージ対応
- 処方箋カード UI（難易度表示・インサイトテキスト付き）
- テスト 53件（処方箋10件追加）

## [0.2.0] - 2026-04-11

### 修正
- ファンチャートを信頼区間帯 (band90/band50) に修正
- チャートカラー hsl(var(--chart-1)) → var(--chart-1) (oklch対応)
- What-if スライダーの stale closure レース修正 (generation counter)
- Worker pending 上書き防止 + cancel() 後のハンドラ再登録
- What-if debounce 300ms 追加
- 退職後の社会保険料 (国保+国民年金) を支出に加算
- seed をランダム化 (毎回異なるシミュレーション結果)
- retirementAge 変更時に endAge を自動 clamp
- NumberInput 金額上限追加 (Infinity 防止)

### 追加
- Web Worker 統合 (メインスレッドブロッキング解消)
- 初回計算のローディングスピナー
- 再計算中のオーバーレイ表示
- 成功確率に解釈テキスト追加 (90%以上=非常に安全 etc)
- ウィザード入力バリデーション (年齢整合性、口座残高)
- 金額入力にカンマ区切り + 万円換算表示
- チャートカラーをグレースケールから青系に変更 (ライト/ダーク)
- NaN 防御 (formToSimulationInput に safeNum() 追加)
- テスト追加: optimizer 5件、form-state 8件 (30→43テスト)

## [0.1.0] - 2026-04-11

### 初回リリース
- モンテカルロ FIRE シミュレーション (1,000-10,000 試行)
- 日本税制エンジン (所得税7段階、住民税、社保、NISA/特定/iDeCo)
- 口座別取り崩し最適化 (全6パターン評価)
- What-if 分析スライダー
- ウィザード形式入力 UI (4ステップ)
- ダーク/ライトテーマ切替
- 30 テスト (税制19件、シミュレーション11件)
