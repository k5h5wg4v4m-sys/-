import json
from narration import SCENES
VO=json.load(open("/tmp/claude-0/ftx/vo/index.json"))
FPS=30; DUR=120.0
START=1.2; GAP=0.45; SCENE_GAP=0.75
SENTS=[]
t=START; prev=0
for v in VO:
    if v["scene"]!=prev: t+=SCENE_GAP; prev=v["scene"]
    st=t; d=v["dur"]
    tot=sum(v["chunks"]); chunks=[]; c=st
    disp=v["disp"].split("|")
    for k,cd in enumerate(v["chunks"]):
        e=c+d*cd/tot; chunks.append((c,e,disp[k].strip())); c=e
    SENTS.append(dict(start=st,end=st+d,file=v["file"],scene=v["scene"],chunks=chunks,disp=v["disp"],spk=v["spk"]))
    t=st+d+GAP
if __name__=="__main__":
    for i,s in enumerate(SENTS): print(i,s["scene"],round(s["start"],2),round(s["end"],2),s["disp"][:50])
