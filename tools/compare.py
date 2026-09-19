"""Stack the current hand render next to the reference for judging."""
import sys
from PIL import Image
S='/private/tmp/claude-501/-Users-viveky/80ae6874-5305-4fe1-b982-9707e84c043d/scratchpad/'
REF='/private/tmp/claude-501/-Users-viveky/80ae6874-5305-4fe1-b982-9707e84c043d/images/4.png'
mine=Image.open(sys.argv[1]).convert('RGB')
ref=Image.open(REF).convert('RGB')
H=560
def fit(im,h):
    w=int(im.width*h/im.height); return im.resize((w,h), Image.LANCZOS)
mine=fit(mine,H); ref=fit(ref,H)
out=Image.new('RGB',(mine.width+ref.width+24,H),(34,32,29))
out.paste(ref,(0,0)); out.paste(mine,(ref.width+24,0))
out.save(sys.argv[2]); print(out.size)
