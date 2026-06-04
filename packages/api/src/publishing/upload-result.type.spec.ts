import type { UploadResultDto } from '@blog/shared';

// T-PUB-201: 업로드 응답에 type 필드 ('image' | 'video') 가 추가된다.
// TypeScript 가 type 필드를 요구하는지 컴파일 시점에 강제하는 회귀 가드.
// 또한 런타임에서도 union 값(image|video)이 그대로 보존되는지 확인.
describe('UploadResultDto.type (T-PUB-201)', () => {
  it("type 필드는 'image' 와 'video' 두 값을 가질 수 있다", () => {
    const imageResult: UploadResultDto = {
      url: '/uploads/abc.jpg',
      contentType: 'image/jpeg',
      size: 1024,
      type: 'image',
    };
    const videoResult: UploadResultDto = {
      url: '/uploads/abc.mp4',
      contentType: 'video/mp4',
      size: 1048576,
      type: 'video',
    };
    expect(imageResult.type).toBe('image');
    expect(videoResult.type).toBe('video');
  });

  it('UploadResultDto 는 url/contentType/size/type 네 필드를 갖는다 (회귀 가드)', () => {
    const result: UploadResultDto = {
      url: '/uploads/x.jpg',
      contentType: 'image/jpeg',
      size: 1,
      type: 'image',
    };
    expect(Object.keys(result).sort()).toEqual(
      ['contentType', 'size', 'type', 'url'].sort(),
    );
  });
});
