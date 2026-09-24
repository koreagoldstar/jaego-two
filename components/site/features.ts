import {
  Package,
  Smartphone,
  ScanLine,
  Barcode,
  QrCode,
  Boxes,
  FolderKanban,
  Table,
  History,
  FileSpreadsheet,
  DatabaseBackup,
  Download,
  type LucideIcon,
} from 'lucide-react'

export type Feature = {
  icon: LucideIcon
  title: string
  desc: string
  points: string[]
  /** 홈 화면 요약에 노출 */
  main?: boolean
}

export const FEATURES: Feature[] = [
  {
    icon: Package,
    title: '품목 관리',
    desc: '장비·자재·소모품을 이름, 위치, 설명과 함께 등록하고 수량을 한눈에 봅니다.',
    points: ['한 번에 최대 100개 일괄 등록', '바코드 값 자동 생성', '보관 위치·메모 기록'],
    main: true,
  },
  {
    icon: Smartphone,
    title: '휴대폰 입·출고',
    desc: '창고와 현장에서 휴대폰으로 바로 입고·출고합니다. 큰 버튼의 현장 전용 화면을 제공합니다.',
    points: ['빠른 수량 버튼', '현장용 입·출고 화면', '출고 시 프로젝트 지정'],
    main: true,
  },
  {
    icon: ScanLine,
    title: '바코드·QR 스캔',
    desc: '휴대폰 카메라로 라벨을 비추면 품목을 찾아 바로 입출고 화면으로 넘어갑니다.',
    points: ['별도 스캐너 없이 카메라로', '바코드·QR 모두 인식', '스캔 즉시 재고 확인'],
    main: true,
  },
  {
    icon: Barcode,
    title: '라벨 만들기',
    desc: '품목별 바코드와 QR 라벨을 만들어 바로 인쇄하거나 이미지로 저장합니다.',
    points: ['CODE128 · CODE39 바코드', '40×20mm 소형 QR 라벨', 'PNG 저장·인쇄'],
    main: true,
  },
  {
    icon: QrCode,
    title: '개별 단위 추적',
    desc: '입고된 장비 한 대 한 대에 고유 QR을 붙여, 어떤 것이 언제 어디로 나갔는지 추적합니다.',
    points: ['단위별 고유 코드', '먼저 들어온 것부터 출고(선입선출)', '실물과 전산 수량 맞추기'],
  },
  {
    icon: Boxes,
    title: '일괄 출고',
    desc: '여러 품목을 연달아 스캔한 뒤 한 번에 출고합니다. 잘못 처리해도 바로 되돌릴 수 있습니다.',
    points: ['연속 스캔 후 한 번에 처리', '출고 되돌리기', '현장 출고 시간 단축'],
    main: true,
  },
  {
    icon: FolderKanban,
    title: '프로젝트별 자재 계획',
    desc: '공사·설치 현장별로 사용할 자재를 미리 잡아 두고, 실제 출고량과 남은 수량을 비교합니다.',
    points: ['예정·출고·잔여 수량', '설치일 관리', '완료 프로젝트 정리'],
    main: true,
  },
  {
    icon: Table,
    title: '재고 요약표',
    desc: '현재 재고, 프로젝트 예정 수량, 실제 남을 수량을 표 하나로 확인합니다.',
    points: ['부족 예상 품목 파악', '프로젝트 예정 반영', '엑셀로 내려받기'],
  },
  {
    icon: History,
    title: '입출고 이력',
    desc: '언제 무엇을 얼마나 넣고 뺐는지 모든 기록이 남습니다. 전체·품목별·프로젝트별로 조회하세요.',
    points: ['전체·품목별·프로젝트별 조회', '이력 수정·삭제', '한국 시간 기준 기록'],
  },
  {
    icon: FileSpreadsheet,
    title: '엑셀 내보내기',
    desc: '이력, 재고 요약, 프로젝트 자료를 엑셀 파일로 받아 보고서에 바로 씁니다.',
    points: ['입출고 이력', '재고 요약표', '프로젝트별 자료'],
  },
  {
    icon: DatabaseBackup,
    title: '데이터 백업',
    desc: '회사 데이터 전체를 파일 하나로 언제든 내려받을 수 있습니다.',
    points: ['버튼 한 번으로 전체 백업', '품목·이력·프로젝트 포함'],
  },
  {
    icon: Download,
    title: '앱처럼 설치',
    desc: '앱스토어 없이 휴대폰 홈 화면에 추가해 앱처럼 씁니다. PC 브라우저에서도 그대로 됩니다.',
    points: ['안드로이드·아이폰 지원', 'PC·태블릿 겸용', '업데이트 자동 반영'],
  },
]
