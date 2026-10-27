import type {ProductInput} from '../core/types'

// These are editorial priorities, never inferred product features or claims.
const profiles = {
  fashion: {label: 'Trang phục', priorities: ['material', 'fit', 'size', 'care', 'color'], checks: ['Chất liệu', 'Form và số đo', 'Cách bảo quản']},
  tech: {label: 'Thiết bị và phụ kiện điện tử', priorities: ['compatibility', 'power', 'size', 'contents', 'usage'], checks: ['Kết nối / tương thích', 'Thông số nguồn điện', 'Kích thước']},
  beauty: {label: 'Sản phẩm làm đẹp', priorities: ['ingredients', 'skin', 'usage', 'size', 'contents'], checks: ['Thành phần', 'Đối tượng sử dụng theo mô tả', 'Hướng dẫn sử dụng']},
  perfume: {label: 'Nước hoa', priorities: ['scent', 'concentration', 'size', 'usage', 'contents'], checks: ['Mô tả mùi hương', 'Nồng độ', 'Dung tích']},
  accessories: {label: 'Phụ kiện', priorities: ['material', 'size', 'color', 'contents', 'care'], checks: ['Chất liệu', 'Kích thước', 'Màu / kiểu dáng']},
  home: {label: 'Đồ gia dụng', priorities: ['size', 'material', 'contents', 'usage', 'color'], checks: ['Kích thước', 'Chất liệu', 'Thành phần bộ']},
}

const nameSignals = [
  {id: 'perfume', pattern: /nước hoa|\bperfume\b|eau de (?:parfum|toilette)/i},
  {id: 'tech', pattern: /tai nghe|cáp sạc|củ sạc|bàn phím|chuột (?:máy tính|không dây|gaming)|loa bluetooth|sạc dự phòng/i},
  {id: 'fashion', pattern: /áo (?:thun|khoác|sơ mi|len)|quần (?:jean|short|dài|tây)|váy|đầm (?:nữ|suông|dạ hội)|chân váy/i},
  {id: 'beauty', pattern: /\bserum\b|sữa rửa mặt|kem dưỡng|son môi|nước tẩy trang|kem chống nắng/i},
  {id: 'accessories', pattern: /túi xách|ví da|dây chuyền|vòng tay|bông tai/i},
] as const

export function buyingProfileFor(product: Pick<ProductInput, 'category' | 'name'>) {
  // The studio currently defaults to home. Strong product-name signals refine editorial
  // priorities without enabling an unsupported category engine or inventing attributes.
  const explicit = Object.hasOwn(profiles, product.category) && product.category !== 'home'
  const named = explicit ? undefined : nameSignals.find((signal) => signal.pattern.test(product.name))
  const id = named?.id || product.category
  const profile = Object.hasOwn(profiles, id) ? profiles[id as keyof typeof profiles] : {label: 'Chọn sản phẩm', priorities: ['size', 'material', 'contents', 'color'], checks: ['Thông số', 'Chất liệu', 'Phiên bản định mua']}
  return {id, ...profile}
}
