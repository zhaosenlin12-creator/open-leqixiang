const urls = [
  "https://codebn.cn/",
  "https://codebn.cn/courses.html",
  "https://codebn.cn/yanxue.html",
  "https://codebn.cn/qidian.html",
  "https://codebn.cn/d/courses.html",
  "https://codebn.cn/singularity.html",
  "https://codebn.cn/singularity.html#sg-rocket",
  "https://codebn.cn/.well-known/acme-challenge/test",
  "https://codebn.cn/d/.well-known/acme-challenge/test",
  "https://codebn.cn/d/images/brand/logo.png",
  "https://codebn.cn/d/images/students/image(1).png",
  "https://codebn.cn/d/images/yanxue/szg-video-743cc56e35f6f216447cc2eb206874d2.mp4",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { redirect: "manual" });
    const ct = r.headers.get("content-type") ?? "?";
    const cl = r.headers.get("content-length") ?? "?";
    console.log(`${u} -> ${r.status}  ct=${ct}  cl=${cl}`);
  } catch (e) {
    console.log(`${u} -> ERROR ${e.message}`);
  }
}
