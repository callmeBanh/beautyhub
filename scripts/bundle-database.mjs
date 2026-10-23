import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";

const files = (await readdir("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const guard = (isNew) => `do $$ begin
 if ${isNew ? "" : "not "}exists(select 1 from information_schema.tables where table_schema='public' and table_name='bookings') then
  raise exception '${isNew ? "Database đã có bảng bookings. Không dùng bản cài mới; kiểm tra migration hiện có trước." : "Chưa có schema BeautyHub gốc. Dùng bản cài mới cho project riêng."}';
 end if;
end $$;\n`;
await mkdir("supabase/generated", { recursive: true });
for (const [name, selected, isNew] of [
  ["install-new.sql", files, true],
  [
    "upgrade-from-original.sql",
    files.filter((file) => !file.startsWith("20261005")),
    false,
  ],
]) {
  let sql =
    "-- Generated; review on a separate class/staging project. Never includes users or payments.\nbegin;\n" +
    guard(isNew);
  if (!isNew)
    sql += `do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='payment_reference') then
  raise exception 'Hardening đã được áp dụng. Không chạy lại upgrade bundle; chỉ chạy từng migration còn thiếu.';
 end if;
end $$;\n`;
  for (const file of selected)
    sql += `\n-- ${file}\n${await readFile(`supabase/migrations/${file}`, "utf8")}\n`;
  sql += "\ncommit;\n";
  await writeFile(`supabase/generated/${name}`, sql);
  console.log(
    `Written supabase/generated/${name} (${selected.length} migrations).`,
  );
}
