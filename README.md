# Vipee

Vipee là studio tạo video sản phẩm cho TikTok từ ảnh và thông tin người dùng cung cấp. Next.js 16 / React 19 / TypeScript, Remotion, Gemini, Cloudflare Workers AI và giọng Google hoặc ElevenLabs.

## Chạy local

```sh
pnpm install
pnpm dev
```

Mở `http://localhost:3000/create`. Có thể nhập thông tin thủ công hoặc import link TikTok Shop. Key Gemini có thể cấu hình bằng `GEMINI_API_KEY` phía server hoặc trong màn hình studio. Không có key thì dùng planner theo dữ liệu đầu vào.

## Cấu hình ảnh bối cảnh Cloudflare

Trong Cloudflare dashboard → Workers AI, chọn **Use REST API → Create a Workers AI API Token** và lấy Account ID. Nếu tạo token thủ công, cấp cả quyền `Workers AI → Read` và `Workers AI → Edit`, giới hạn cho đúng account. Theo [hướng dẫn REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).

Thêm vào `.env.local` (chỉ phía server, không dùng tiền tố NEXT_PUBLIC):

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_32_character_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
```

Khởi động lại `pnpm dev`, bật **Tạo bối cảnh sản phẩm bằng AI** và phân tích sản phẩm. Gemini API key vẫn chỉ phục vụ phân tích/kịch bản; không gửi đến endpoint tạo bối cảnh.

Giữ **Workers Free** để không phát sinh phí Workers AI: có 10.000 Neurons/ngày dùng chung toàn account; hết quota sẽ báo lỗi, reset lúc 7 giờ sáng Việt Nam. App không nâng cấp plan, không mua credits, không gọi Gemini để dự phòng. Nếu account đã ở Workers Paid, API có thể bị tính phí vượt hạn mức: code không tự xác minh billing plan của account. [Chính sách giá](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Luồng lập nội dung mới

1. Phân loại ảnh và thu thập thông tin sản phẩm có nguồn.
2. Khi có Gemini, gửi tối đa ba ảnh nén để phân tích nội dung, vùng toàn sản phẩm và vùng chi tiết. Upload local được mã hóa trong browser; ảnh URL cần cho phép CORS.
3. Chọn góc thiết kế, thông tin/tính năng hoặc hướng dẫn chọn mua. Không mặc định vấn đề gia dụng cho mọi ngành hàng.
4. Mỗi cảnh có mục đích, ảnh cụ thể, vùng crop và nguồn thông tin. Nội dung cảnh thông tin dùng dữ liệu đầu vào hoặc quan sát ảnh; không tự thêm trải nghiệm cá nhân hay ưu đãi.
5. Khi bật bối cảnh AI, app gọi `/api/assets/context` qua Cloudflare Workers AI để tạo một ảnh dọc từ ảnh tham chiếu, dùng chung cho cảnh mở đầu/kết thúc. Kết quả được nén và tái sử dụng; không có nhãn “Bối cảnh AI” trên video. Có thể tải ảnh bối cảnh có sẵn lên.
6. Preview và Remotion render sử dụng cùng scene plan. Infographic/FFmpeg dự phòng giữ ảnh và nội dung có nguồn, không thêm voucher hoặc lợi ích mẫu.
7. Thời lượng mặc định mục tiêu 22 giây. Planner đề xuất ngắn hơn khi ít dữ liệu; thời lượng thực tế cập nhật sau khi tạo voice theo từng cảnh.
8. Đổi góc nội dung lập lại cả storyboard. Thay câu mở đầu cập nhật lời đọc và phân bổ thời lượng.

Bảng kế hoạch trên studio hiển thị format, lý do lựa chọn, số ảnh đọc được và thông tin còn thiếu. Không dùng điểm nội bộ như dự báo chuyển đổi.

## Bố cục TikTok

Luồng adaptive dùng canvas 1080×1920 và vùng nội dung bảo thủ: chừa trên 240px, dưới 660px, trái 120px, phải 180px. Đây là preset của studio, không phải bảo đảm cố định của TikTok. Hook, thông tin, phụ đề và CTA được bố trí trong vùng này; chữ dài tự co để giữ nguyên nội dung. Ảnh bối cảnh dùng khung dọc lớn, ảnh chi tiết dùng crop của planner; chuyển động zoom nằm trong khung ảnh.

Preview có **Chỉ video / Giao diện TikTok / Vùng an toàn**. Lớp mô phỏng là phần tử bên ngoài Player, không được truyền vào renderer hoặc ghi vào MP4. Vị trí giao diện thực tế có thể thay đổi theo thiết bị, caption và giỏ hàng. Video MP4 đã xuất trước đó cần render lại để áp dụng bố cục mới.

## Nội dung giúp chọn mua

Gemini nhận ảnh và dữ liệu sản phẩm trong lần phân tích hiện có, chọn một fact làm trọng tâm và trả ba hook, câu hỏi chọn mua, lời thoại từng cảnh và CTA. Nội dung AI hợp lệ được sử dụng thực sự; không ghi đè bằng câu mẫu. Chữ số/đơn vị, nguồn fact, asset, ngân sách lời đọc, vật liệu phổ biến và một số khẳng định/ưu đãi không có nguồn được kiểm tra. Đây là kiểm tra bằng quy tắc, không phải chứng minh ngữ nghĩa; vẫn cần xem lại trước khi đăng.

Một câu/hook không hợp lệ dùng dự phòng riêng, giữ các phần AI hợp lệ. Studio hiển thị nguồn hook, lời đọc và CTA (Gemini / kết hợp dự phòng / theo dữ liệu đầu vào). Đổi hook giữ nguyên thân kịch bản và ảnh bối cảnh, không gọi API phân tích/tạo ảnh; voice cập nhật theo lời thoại mới. Một phản hồi Gemini hợp lệ chỉ cần một request; model dự phòng chỉ được thử khi phản hồi toàn bộ lỗi. Lượng token có thể tăng vì nội dung trả về nhiều hơn.

Ảnh được chọn theo quan sát khớp fact; chỉ crop khi có quan sát phù hợp. Bố cục mở đầu dùng ảnh bối cảnh lớn, cảnh thông tin nhấn fact gốc để đối chiếu, cảnh chọn mua dùng ảnh gốc và câu hỏi trước khi đặt. Phụ đề chia cụm và nhấn thông số, thời điểm vẫn là ước lượng theo lời đọc. Không thêm lần gọi Cloudflare cho các cải tiến này.

Hiệu quả click/mua cần số liệu video đăng thật. Chữ giỏ hàng trong video không tự gắn sản phẩm khi đăng.

## Voice

Trong phần Giọng thuyết minh, chọn Google để test hoặc ElevenLabs để làm video chính thức. Google dùng Google Translate TTS hiện có, không phải Google Cloud TTS. Nhà cung cấp được chọn tường minh; Google lỗi không tự gọi ElevenLabs. ElevenLabs cần `ELEVENLABS_API_KEY` phía server.

## File sinh khi test

`output/` chứa ảnh/video demo, kết quả QA và bundle Remotion local, được bỏ qua trong Git. Bundle có thể tạo lại bằng script render; không dùng làm mã nguồn của app. Ảnh và video demo được giữ để xem lại.

## Kiểm tra

```sh
pnpm typecheck
pnpm test:planning
pnpm lint
```

`test:planning` dùng `node:test` và TypeScript đã cài, không gọi API bên ngoài. Bao phủ ít dữ liệu, các ngành hàng, đổi góc, gán ảnh, nguồn thông tin, bounds crop, lỗi AI, số thập phân và thời lượng audio.

Mã chính:

- `src/engines/planning/AdaptiveVideoPlanner.ts`: planner dựa trên đầu vào.
- `src/lib/ai/gemini.ts`: phân tích đa phương thức và kiểm tra kết quả AI.
- `src/lib/ai/prepare-images.ts`: chuẩn bị ảnh trong browser.
- `src/remotion/PlannedCommerceScene.tsx`: dựng cảnh trực tiếp từ kế hoạch.
- `src/lib/video/scene-timing.ts`: đồng bộ thời lượng lời đọc.

## Giới hạn đợt cải tiến đầu

- Kiểm thử tự động dùng phản hồi AI mock. Tạo ảnh thật cần cấu hình Cloudflare; chất lượng giữ đúng sản phẩm và vị trí crop vẫn cần người dùng xem lại.
- Ảnh không tải được qua CORS sẽ không được phân tích thị giác; studio báo số ảnh đọc được. Có thể tải ảnh lên trực tiếp.
- Tạo bối cảnh dùng Cloudflare FLUX.2 klein 4B, không gọi Gemini và không tự đổi provider khi lỗi. Ảnh tham chiếu được nén xuống tối đa 511×511; ảnh đầu ra 768×1344. Cache trong bộ nhớ giữ tối đa 16 ảnh và gộp request đồng thời; restart server sẽ mất cache. Thay bối cảnh không tạo lại voice khi lời thoại không đổi.
- Chưa dựng clip demo trong luồng adaptive, chưa có A/B analytics hoặc dữ liệu mua hàng. Chưa triển khai gắn giỏ hàng qua TikTok Shop Partner API.
- Phụ đề khớp thời lượng cảnh; vị trí từng cụm từ được ước lượng, chưa có forced alignment.
