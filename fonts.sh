# 进入字体目录
cd assets/fonts/

# 批量将所有 ttf 转为 woff2
for f in *.ttf; do
  woff2_compress "$f" && echo "✅ $f → ${f%.ttf}.woff2"
done