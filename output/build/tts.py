import subprocess, json, sys, os, wave
from narration import SCENES
RATE=sys.argv[1] if len(sys.argv)>1 else "80"
os.makedirs("vo",exist_ok=True)
def synth(text, fn):
    subprocess.run(["RHVoice-test","-p","artemiy","-r",RATE,"-o",fn],input=text.encode(),check=True)
    w=wave.open(fn); return w.getnframes()/w.getframerate()
out=[]; tot=0; words=0
for si,(a,b,sents) in enumerate(SCENES):
    sd=0
    for ji,(disp,spk) in enumerate(sents):
        full=spk.replace("|"," ")
        fn=f"vo/s{si}_{ji}.wav"; d=synth(full,fn)
        cd=[synth(c.strip(),f"vo/tmp.wav") for c in spk.split("|")]
        out.append(dict(scene=si,idx=ji,file=fn,dur=d,chunks=cd,disp=disp,spk=spk))
        sd+=d; words+=len(disp.replace("|"," ").replace("*","").split())
    print(f"scene {si}: speech {sd:.1f}s  window {b-a}s")
    tot+=sd
print("total speech",round(tot,1),"words",words)
json.dump(out,open("vo/index.json","w"),ensure_ascii=False,indent=1)
