// 후속 태스크(T-WEB-002~007)에서 실제 페이지로 교체될 자리표시자
export function Placeholder({ name }: { name: string }) {
  return (
    <div data-testid={`page-${name}`} className="p-8 text-center">
      {name}
    </div>
  );
}
