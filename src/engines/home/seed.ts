import { ProductInput } from '../core/types'

export const CABLE_ORGANIZER_SEED_PRODUCT: ProductInput = {
  id: 'seed-cable-organizer',
  name: 'Miếng kẹp giữ cố định dây sạc silicon',
  category: 'home',
  price: 39000,
  originalPrice: 65000,
  currency: 'VND',
  description: 'Kẹp giữ dây sạc silicon nhiều rãnh dán mép bàn, chống rơi dây sạc xuống đất, giữ bàn làm việc gọn gàng ngăn nắp.',
  problemSolved: 'Dây sạc thường xuyên rơi xuống gầm bàn mỗi khi rút máy và làm bàn làm việc lộn xộn.',
  features: [
    'Chất liệu silicon cao cấp dẻo dai, không làm xước dây',
    'Keo dán 3M siêu chắc dán được lên gỗ, kính, kim loại',
    'Thiết kế 5 rãnh giữ cùng lúc sạc điện thoại, laptop, tai nghe',
  ],
  benefits: [
    'Giữ nhiều dây sạc cố định ngay mép bàn',
    'Không còn cảnh phải cúi xuống đất nhặt dây sạc',
    'Bàn làm việc gọn gàng thẩm mỹ tức thì',
  ],
  howToUse: 'Lau sạch mép bàn, bóc lớp dán keo 3M và ấn chặt miếng kẹp vào vị trí trong 10 giây, sau đó gắn dây sạc vào rãnh.',
  targetAudience: 'Dân văn phòng, người làm việc tại nhà, học sinh sinh viên có nhiều thiết bị sạc.',
  productUrl: 'https://shop.tiktok.com/view/product/172948201938',
  shopProductId: '172948201938',
  assets: [
    {
      id: 'asset-seed-1',
      name: 'cable-organizer-desk.jpg',
      size: 145000,
      type: 'PRODUCT_IMAGE',
      url: 'https://images.unsplash.com/photo-1541140532154-b024d705b909?w=800&auto=format&fit=crop&q=80',
      isPrimary: true,
    },
    {
      id: 'asset-seed-2',
      name: 'cable-organizer-detail.jpg',
      size: 120000,
      type: 'DETAIL_IMAGE',
      url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80',
      isPrimary: false,
    },
  ],
}
