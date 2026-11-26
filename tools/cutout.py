import cv2, numpy as np, onnxruntime as ort, sys, os
src='/home/claude/avenoir/img/catalogue/'; out=sys.argv[1]; ids=sys.argv[2:]
sess=ort.InferenceSession('/tmp/claude-0/isnet.onnx',providers=['CPUExecutionProvider']); inp=sess.get_inputs()[0].name
for i in ids:
    f=src+i+'-1800.jpg'
    if not os.path.exists(f): f=src+i+'-1600.jpg'
    if not os.path.exists(f): f=src+i+'-1200.jpg'
    im=cv2.imread(f); H,W=im.shape[:2]
    x=cv2.resize(cv2.cvtColor(im,cv2.COLOR_BGR2RGB),(1024,1024),interpolation=cv2.INTER_AREA).astype(np.float32)/255.0
    x=(x-0.5)/1.0; x=x.transpose(2,0,1)[None]
    p=sess.run(None,{inp:x})[0][0,0]; p=(p-p.min())/(p.max()-p.min()+1e-6)
    P=cv2.resize(p,(W,H),interpolation=cv2.INTER_CUBIC).clip(0,1)
    M=(P>0.5).astype(np.uint8)*255
    n,lb,st,_=cv2.connectedComponentsWithStats(M); M=np.where(lb==1+np.argmax(st[1:,4]),255,0).astype(np.uint8)
    ff=M.copy(); mk=np.zeros((H+2,W+2),np.uint8); cv2.floodFill(ff,mk,(0,0),255); M=M|cv2.bitwise_not(ff)
    # edge band: use colour distance from the (uniform) background for an exact, soft edge
    lab=cv2.cvtColor(im,cv2.COLOR_BGR2LAB).astype(np.float32)
    bgc=np.median(np.concatenate([lab[:10].reshape(-1,3),lab[-10:].reshape(-1,3),lab[:,:10].reshape(-1,3),lab[:,-10:].reshape(-1,3)]),axis=0)
    d=np.linalg.norm(lab-bgc,axis=2); ramp=np.clip((d-2.0)/(12-2.0),0,1)
    inner=cv2.erode(M,np.ones((13,13),np.uint8))>0; outer=cv2.dilate(M,np.ones((7,7),np.uint8))>0
    band_alpha=np.maximum(ramp,np.clip((P-0.3)/0.4,0,1)*0.0)
    alpha=np.where(inner,1.0,np.where(outer,np.maximum(ramp,np.clip((P-0.5)*2,0,1)),0.0)).astype(np.float32)
    # the photo's floor shadow under the bracelet is not part of the watch
    ys0=np.where(M.any(1))[0]; y0,y1=ys0.min(),ys0.max(); cut=int(y1-(y1-y0)*0.14)
    alpha[cut:]=np.minimum(alpha[cut:],np.clip((d[cut:]-5)/(14-5),0,1))
    n2,lb2,st2,_=cv2.connectedComponentsWithStats((alpha>0.5).astype(np.uint8)); keep=lb2==1+np.argmax(st2[1:,4]); alpha=np.where(cv2.dilate(keep.astype(np.uint8),np.ones((5,5),np.uint8))>0,alpha,0)
    alpha=np.minimum(alpha,cv2.erode(alpha,np.ones((3,3),np.uint8))*0.5+alpha*0.5)
    alpha=cv2.GaussianBlur(alpha,(0,0),0.5)
    bg_bgr=np.median(np.concatenate([im[:10].reshape(-1,3),im[-10:].reshape(-1,3)]),axis=0).astype(np.float32)
    A=np.clip(alpha,0.05,1)[...,None]; C=np.clip((im.astype(np.float32)-(1-A)*bg_bgr)/A,0,255)
    C=np.where(alpha[...,None]>0.95,im.astype(np.float32),np.minimum(C,im.astype(np.float32)+0))   # never brighter than the photo
    bl=cv2.GaussianBlur(C,(0,0),1.0); C=np.clip(C+0.35*(C-bl),0,255)
    rgba=np.dstack([C.astype(np.uint8),(alpha*255).astype(np.uint8)])
    ys,xs=np.where(alpha>0.03); rgba=rgba[ys.min():ys.max()+1,xs.min():xs.max()+1]
    if rgba.shape[0]>1500: f=1500/rgba.shape[0]; rgba=cv2.resize(rgba,None,fx=f,fy=f,interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{out}/{i}.png',rgba,[cv2.IMWRITE_PNG_COMPRESSION,9]); cv2.imwrite(f'{out}/{i}.webp',rgba,[cv2.IMWRITE_WEBP_QUALITY,92])
    print(i,rgba.shape)
