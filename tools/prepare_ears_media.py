"""Prepare the approved local intro and selection as small, seekable web videos.

Usage: python tools/prepare_ears_media.py /path/to/humaneness
Requires ffmpeg/ffprobe; source masters stay outside the website repository.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import argparse, hashlib, json, subprocess

REPO=Path(__file__).resolve().parents[1]
OUT=REPO/'docs/assets/video/humaneness-ears'
FILES={
    'reflection':'01-original-01-1080p-0-100.mp4',
    'anger':'02-original-02-1080p-0-100.mp4',
    'fear':'03-original-03-1080p-0-100.mp4',
    'softness':'04-original-04-1080p-0-100.mp4',
    'ryder':'25-ryder-1080p-0-100.mp4',
    'killian':'31-killian-1080p-0-100.mp4',
    'persephone':'38-persephone-1080p-0-100.mp4',
    'elara':'42-elara-1080p-0-100.mp4',
}

def encode(job):
    slug,source=job;intro=slug=='intro';target=OUT/(slug+'.mp4')
    height=720 if intro else 1080
    cmd=['ffmpeg','-v','error','-y','-threads','4','-i',str(source),'-map','0:v:0','-map','0:a:0','-vf',f'scale=-2:{height}',
         '-filter_threads','2','-c:v','libx264','-threads','4','-preset','medium','-crf','25',
         '-maxrate','1400k' if intro else '2200k','-bufsize','2800k' if intro else '4400k',
         '-pix_fmt','yuv420p','-profile:v','high','-g','60','-c:a','aac','-b:a','128k',
         '-movflags','+faststart','-map_metadata','-1',str(target)]
    subprocess.run(cmd,check=True)
    poster=OUT/(slug+'.webp');at='4.5' if intro else '3.0'
    subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-ss',at,'-i',str(target),'-frames:v','1','-vf','scale=1280:-2',
                    '-c:v','libwebp','-quality','88','-compression_level','6',str(poster)],check=True)
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(target)]))
    v=next(s for s in info['streams'] if s['codec_type']=='video')
    row={'id':slug,'source_file':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
         'source_bytes':source.stat().st_size,'file':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
         'duration_s':float(info['format']['duration']),'width':v['width'],'height':v['height'],'poster':poster.name,'poster_bytes':poster.stat().st_size,
         'encoding':'H.264 / AAC 128 kbps / faststart; intro 720p, samples 1080p'}
    print('READY',slug,round(row['source_bytes']/1e6,2),'→',round(row['bytes']/1e6,2),'MB',flush=True)
    return row

def main():
    p=argparse.ArgumentParser();p.add_argument('source_root',type=Path);args=p.parse_args()
    OUT.mkdir(exist_ok=True,parents=True)
    jobs=[('intro',args.source_root/'output/intro-flight-singalong-v2/humaneness-ears-intro-1080p.mp4')]
    jobs += [(slug,args.source_root/'selection'/name) for slug,name in FILES.items()]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(encode,j) for j in jobs];rows=[f.result() for f in as_completed(futures)]
    rows.sort(key=lambda x:x['id'])
    (OUT/'manifest.json').write_text(json.dumps({'files':rows,'source_note':'Intro V2 and eight user-selected synthetic voice demonstrations. All masters retained unchanged outside this repository.'},indent=2))
    print('ALL MEDIA READY',round(sum(x['bytes'] for x in rows)/1e6,2),'MB',flush=True)

if __name__=='__main__':main()
