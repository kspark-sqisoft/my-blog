import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichEditor } from './RichEditor';

// T-WEB-301: 본문 작성용 WYSIWYG 에디터.
// ProseMirror 가 jsdom 에서 동작하므로 단위 수준에서 도구바·확장의 통합 동작을 검증한다.
//
// 도구바 명령은 editor.chain().focus().<cmd>().run() 패턴 — 빈 본문에 즉시 적용해
// 결과 HTML 이 화이트리스트 마크업으로만 구성되는지(인라인 style 부재) 확인한다.

function setup() {
  const onChange = vi.fn<(html: string) => void>();
  const utils = render(
    <RichEditor value="<p>안녕</p>" onChange={onChange} />,
  );
  return { onChange, ...utils };
}

describe('RichEditor (T-WEB-301)', () => {
  it('도구바와 편집 영역이 렌더링된다', async () => {
    setup();
    expect(
      await screen.findByRole('toolbar', { name: '본문 서식' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /굵게/ })).toBeInTheDocument();
    expect(screen.getByLabelText('본문')).toBeInTheDocument();
  });

  it('초기 value 가 렌더된다', async () => {
    setup();
    await waitFor(() => {
      expect(document.querySelector('.ab-rich-editor')?.innerHTML).toContain(
        '안녕',
      );
    });
  });

  it('굵게 버튼 클릭 후 입력하면 <strong> 으로 직렬화된다', async () => {
    const { onChange } = setup();
    const editorEl = await screen.findByLabelText('본문');
    // 전체 텍스트 선택 후 굵게 토글
    act(() => {
      (editorEl as HTMLElement).focus();
      // 전체 선택 — ProseMirror 의 select-all
      fireEvent.keyDown(editorEl, { key: 'a', code: 'KeyA', ctrlKey: true });
    });
    fireEvent.click(screen.getByRole('button', { name: /굵게/ }));
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).toMatch(/<strong>안녕<\/strong>/);
    });
  });

  it('색 select 변경 시 span 에 화이트리스트 Tailwind 클래스만 부착된다 (인라인 style 부재)', async () => {
    const { onChange } = setup();
    const editorEl = await screen.findByLabelText('본문');
    act(() => {
      (editorEl as HTMLElement).focus();
      fireEvent.keyDown(editorEl, { key: 'a', code: 'KeyA', ctrlKey: true });
    });
    const colorSelect = screen.getByLabelText('글자 색');
    fireEvent.change(colorSelect, { target: { value: 'text-rose-500' } });
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).toMatch(/<span[^>]+class="[^"]*text-rose-500/);
      expect(last).not.toMatch(/style=/);
    });
  });

  it('크기 select 변경 시 span class="text-lg" 가 부착된다', async () => {
    const { onChange } = setup();
    const editorEl = await screen.findByLabelText('본문');
    act(() => {
      (editorEl as HTMLElement).focus();
      fireEvent.keyDown(editorEl, { key: 'a', code: 'KeyA', ctrlKey: true });
    });
    const sizeSelect = screen.getByLabelText('글자 크기');
    fireEvent.change(sizeSelect, { target: { value: 'text-lg' } });
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).toMatch(/<span[^>]+class="[^"]*text-lg/);
    });
  });

  it('이미지 업로드 콜백 결과로 setImage 가 호출되고 <img> 노드가 삽입된다', async () => {
    const onChange = vi.fn<(html: string) => void>();
    const onUploadMedia = vi.fn(async () => ({
      url: '/uploads/x.jpg',
      type: 'image' as const,
    }));
    render(
      <RichEditor
        value=""
        onChange={onChange}
        onUploadMedia={onUploadMedia}
      />,
    );
    const input = screen.getByLabelText('미디어 업로드') as HTMLInputElement;
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(onUploadMedia).toHaveBeenCalledWith(file);
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).toMatch(/<img[^>]+src="\/uploads\/x\.jpg"/);
    });
  });

  it('MP4 업로드 결과는 <video controls preload="metadata" playsinline> 노드로 삽입된다', async () => {
    const onChange = vi.fn<(html: string) => void>();
    const onUploadMedia = vi.fn(async () => ({
      url: '/uploads/y.mp4',
      type: 'video' as const,
    }));
    render(
      <RichEditor
        value=""
        onChange={onChange}
        onUploadMedia={onUploadMedia}
      />,
    );
    const input = screen.getByLabelText('미디어 업로드') as HTMLInputElement;
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).toMatch(/<video[^>]+src="\/uploads\/y\.mp4"/);
      expect(last).toMatch(/controls/);
      expect(last).toMatch(/preload="metadata"/);
      expect(last).toMatch(/playsinline/);
    });
  });

  // T-WEB-307: 형광펜/위·아래첨자/정렬/실행취소
  function selectAll(editorEl: HTMLElement) {
    act(() => {
      editorEl.focus();
      fireEvent.keyDown(editorEl, { key: 'a', code: 'KeyA', ctrlKey: true });
    });
  }

  it('형광펜 버튼 → <mark> 로 직렬화된다', async () => {
    const { onChange } = setup();
    selectAll(await screen.findByLabelText('본문'));
    fireEvent.click(screen.getByRole('button', { name: '형광펜' }));
    await waitFor(() =>
      expect(onChange.mock.calls.at(-1)?.[0] ?? '').toMatch(
        /<mark>안녕<\/mark>/,
      ),
    );
  });

  it('위첨자 버튼 → <sup> 로 직렬화된다', async () => {
    const { onChange } = setup();
    selectAll(await screen.findByLabelText('본문'));
    fireEvent.click(screen.getByRole('button', { name: '위첨자' }));
    await waitFor(() =>
      expect(onChange.mock.calls.at(-1)?.[0] ?? '').toMatch(/<sup>안녕<\/sup>/),
    );
  });

  it('아래첨자 버튼 → <sub> 로 직렬화된다', async () => {
    const { onChange } = setup();
    selectAll(await screen.findByLabelText('본문'));
    fireEvent.click(screen.getByRole('button', { name: '아래첨자' }));
    await waitFor(() =>
      expect(onChange.mock.calls.at(-1)?.[0] ?? '').toMatch(/<sub>안녕<\/sub>/),
    );
  });

  it('가운데 정렬 → 문단에 text-center 클래스가 부착된다(인라인 style 부재)', async () => {
    const { onChange } = setup();
    selectAll(await screen.findByLabelText('본문'));
    fireEvent.click(screen.getByRole('button', { name: '가운데 정렬' }));
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).toMatch(/<p[^>]+class="[^"]*text-center/);
      expect(last).not.toMatch(/style=/);
    });
  });

  it('실행취소/되돌리기 버튼이 렌더된다(동작은 TipTap history 내장)', async () => {
    setup();
    expect(
      await screen.findByRole('button', { name: /실행취소/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /되돌리기/ })).toBeInTheDocument();
  });

  it('생성된 HTML 에는 인라인 style 이 들어가지 않는다 (회귀 가드)', async () => {
    const { onChange } = setup();
    const editorEl = await screen.findByLabelText('본문');
    act(() => {
      (editorEl as HTMLElement).focus();
      fireEvent.keyDown(editorEl, { key: 'a', code: 'KeyA', ctrlKey: true });
    });
    // 굵게 + 색 + 크기 모두 적용
    fireEvent.click(screen.getByRole('button', { name: /굵게/ }));
    fireEvent.change(screen.getByLabelText('글자 색'), {
      target: { value: 'text-emerald-500' },
    });
    fireEvent.change(screen.getByLabelText('글자 크기'), {
      target: { value: 'text-xl' },
    });
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] ?? '';
      expect(last).not.toMatch(/style=/);
    });
  });
});
