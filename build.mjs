// 使い方: STATICRYPT_PASSWORD=... node build.mjs <exportディレクトリ>
// exportディレクトリには tasks/ projects/ days/ の下に <doc_id>.json がある想定
// (ダッシュボードのデータベースを ArtifactData の out_dir で書き出したもの)。
// 平文のページは .build/ に作り、暗号化した index.html だけをリポジトリ直下に出力する。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const exportDir = process.argv[2];
if (!exportDir) { console.error("exportディレクトリを指定してください"); process.exit(1); }
if (!process.env.STATICRYPT_PASSWORD) { console.error("STATICRYPT_PASSWORD が未設定です"); process.exit(1); }

const readColl = (name) => {
  const dir = path.join(exportDir, name);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const doc = raw && typeof raw === "object" && raw.data && typeof raw.data === "object" ? raw.data : raw;
    return { id: f.replace(/\.json$/, ""), ...doc };
  });
};

const data = {
  builtAt: new Date().toISOString(),
  tasks: readColl("tasks"),
  projects: readColl("projects"),
  days: readColl("days"),
  members: readColl("members"),
};
if (!data.tasks.length && !data.projects.length && !data.days.length) {
  console.error("データが空です。書き出しを確認してください"); process.exit(1);
}

const here = path.dirname(new URL(import.meta.url).pathname);
const tpl = fs.readFileSync(path.join(here, "template.html"), "utf8");
// </script> を含む文字列で埋め込みが壊れないよう "<" をエスケープ
const json = JSON.stringify(data).replace(/</g, "\\u003c");
const html = tpl.replace("/*__DATA__*/null", json);

const buildDir = path.join(here, ".build");
fs.mkdirSync(buildDir, { recursive: true });
const plain = path.join(buildDir, "index.html");
fs.writeFileSync(plain, html);

execFileSync("npx", [
  "--yes", "staticrypt@3.5.4", path.relative(here, plain),
  "-d", ".",
  "--short",
  "--remember", "30",
  "--config", ".staticrypt.json",
  "--template-title", "Wick 進行管理",
  "--template-instructions", "閲覧にはパスワードが必要です",
  "--template-placeholder", "パスワード",
  "--template-button", "ひらく",
  "--template-remember", "この端末で30日間ログインしたままにする",
  "--template-error", "パスワードが違います",
  "--template-color-primary", "#0f5e6e",
  "--template-color-secondary", "#f3f5f6",
], { stdio: "inherit", cwd: here, env: process.env });

fs.rmSync(buildDir, { recursive: true, force: true });
console.log(`暗号化済み index.html を出力しました(tasks ${data.tasks.length} / projects ${data.projects.length} / days ${data.days.length} / members ${data.members.length})`);
