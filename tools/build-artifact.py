"""Produce dist/table-stakes.html: index.html without the document wrapper and
with the stylesheet inlined, for hosts that wrap the page in their own skeleton."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'css/site.css').read_text()
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
head = re.sub(r'<meta [^>]*>\s*', '', head)
head = re.sub(r'<link rel="stylesheet" href="css/site.css[^"]*">', lambda m: '<style>\n' + css + '\n</style>', head)
head = head.replace('<title>Table Stakes — by Rox</title>', '<title>Table Stakes</title>')
out = head.strip() + '\n' + body.strip() + '\n'
(root / 'dist/table-stakes.html').write_text(out)
print('dist/table-stakes.html', len(out), 'bytes')
