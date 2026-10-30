# Google Vids local bridge — experimental smoke test

## Chạy trọn luồng local bằng một lệnh

Từ thư mục project, chạy:

```bash
pnpm video:local
```

Lệnh này khởi động đồng thời Video Studio tại
`http://127.0.0.1:3000/create` và Google Vids bridge tại
`http://127.0.0.1:4317`. Giữ cửa sổ lệnh, tab Google Vids và extension mở
đến khi MP4 cuối được render xong. Nhấn `Ctrl+C` sẽ dừng cả hai tiến trình.

Sau khi bridge mở, sao chép mã kết nối vào extension, chọn đúng tab Google
Vids rồi thực hiện luồng sản phẩm trong Video Studio. Đây là mốc chạy hoàn
chỉnh đơn giản trên một máy; chưa dùng hàng đợi cloud hoặc worker Vercel.

## Luồng Create tự động — extension 0.3.0

### Kiểm tra đường thao tác trong luồng Video Studio hiện tại

Sau khi chọn/cắt ảnh tham chiếu, Gemini đọc chính ảnh đó để xác định điểm
cầm hoặc mặt đặt, lối vào, khoảng trống cho cả tay và vật, và mặt đỡ cuối.
Planner ghép đường đi từ cấu tạo quan sát được, không tra hành động theo
tên sản phẩm. Khoang mở phía trên dùng hướng từ trên xuống; mặt trước/bên
chỉ dùng khi thực sự mở và đủ chỗ. Đồ nhỏ rời có điểm cầm rõ mới được nhấc;
cầm–đặt cần thêm mặt đặt nhìn thấy. Chưa rõ, vướng hoặc không vừa thì chưa
tạo clip. Kết quả đọc ảnh được cache, không tạo Vids khi chuẩn bị ảnh.

API tạo mới kiểm tra lại phiên bản, ảnh và prompt với kế hoạch canonical
trước khi gọi bridge. Cache clip/tác vụ cũ vẫn đọc được, nhưng không dùng
prompt cũ để lách bước kiểm tra của tác vụ mới. Đổi lời bán hàng không tạo
lại clip; không tự retry Generate khi lỗi.

Khi xem thử có thể đọc 12 khung gốc theo thứ tự bằng Gemini. Báo cáo lỗi
được đưa về panel để gỡ duyệt/chặn xuất; cắt mép hiển thị không xóa báo cáo
lỗi nguồn. Gemini từng bỏ sót một clip đi xuyên giỏ, nên báo cáo không phải
duyệt tự động. Cần xem hết thao tác, tiếp xúc, buông tay và đường rút tay.
Tiêu đề intro được đặt ngoài vùng hình để không che lối tay đi vào từ trên.

Một lượt thực tế với kệ rửa chén và đường đặt từ trên xuống đã tạo clip mới
8 giây; MP4 ghép chuẩn ở `output/rack-standard-review/rack-standard-final.mp4`.
Đây là kết quả thử trên một sản phẩm, chưa chứng minh mọi sản phẩm hoặc
mọi clip đều giữ đúng hình học. Các ghi chú lịch sử bên dưới mô tả những
phiên bản trước và không thay thế luồng hiện tại này.

Luồng Video Studio dùng engine `create-ui`: extension thao tác trực tiếp trên
giao diện Google Vids để mở Create, mở ô nhập đang thu gọn nếu cần, chọn
Portrait và 8 giây, thay ảnh tham chiếu, nhập prompt, đọc lại trạng thái rồi
bấm Generate đúng một lần. MP4 kết quả được tải về bridge và lưu trong cache
của app, không phải tải/xuất toàn bộ tài liệu Vids hoặc nhấn Insert.

Đã kiểm chứng một lượt thật qua API của app: tự chuẩn bị ảnh/prompt, tạo và
nhận clip **8 giây, 720×1280, 24 fps**. Kết quả:
`output/vids-research/native-live-test.json`. Đã dùng đúng một lượt Generate;
không có retry, số lượt còn lại của phiên kiểm tra là 0. Chất lượng hình dáng
sản phẩm vẫn cần người dùng duyệt; tự động hóa thành công không có nghĩa AI
đã giữ đúng mọi chi tiết hoặc đạt tiền kiểm TikTok.

Để dùng: Reload extension lên 0.3.0, mở cửa sổ kết nối mới, chọn tab Vids đã
đăng nhập và kết nối bằng mã local. Trong Bước 3 chọn Google Vids, kiểm tra
kết nối, duyệt ảnh rồi tạo clip. Không cần tự chuyển tab, copy prompt, tải
MP4 hoặc tạo clip học mẫu. Khi local đã hết lượt, khởi động lại bridge theo
giới hạn bạn muốn dùng; không coi giới hạn local là số dư quota Google.

Các tác vụ legacy/upload giữ để chẩn đoán. Tác vụ `create-ui` yêu cầu
`nativeProtocol=1`; extension cũ không được nhận chúng và app không tự chuyển
về request seed khi Create gặp lỗi. Google auth nằm trong tab, không đọc
Cookie hoặc đưa header/token ra local. Chỉ snapshot đã lọc của giao diện
được dùng cho chẩn đoán; không lưu raw payload Google.

Guard trước khi request Generate thực sự rời tab kiểm tra đúng prompt và
đúng handle ảnh vừa upload, chỉ một ảnh tham chiếu và một request cho mỗi
job. Google thay schema, sai ảnh, lỗi HTTP/network, timeout hoặc không đọc
được kết quả thì dừng, không tự bấm Generate lần nữa. Mọi kết quả tải về vẫn
giữ watermark của nguồn; xử lý dấu nhìn thấy ở demo là bước riêng.

Kiểm thử: `pnpm test:vids-bridge`, `pnpm test:vids`, và
`pnpm test:vids-native`. Bài native chạy Chromium với mọi request bị chặn/
giả lập, kiểm tra đổi Create/Portrait/8 giây, upload native, đọc lại prompt,
chặn sai ảnh trước mạng, chặn gửi trùng và không retry HTTP lỗi. Không dùng
tài khoản hoặc quota Google cho các bài kiểm thử.

Phần dưới mô tả các bản thử trước 0.3 để tham khảo; seed/blueprint không còn
quyết định cấu hình tạo clip của luồng Video Studio mới.

Bridge cho **ảnh mới → upload Google → generate → MP4**, có chế độ thử nghiệm
tùy chọn trong `/create` trên local. Người dùng đã xác nhận upload thật thành công ở v0.1.3 và tạo
clip thành công ở v0.2.0. File MP4 kiểm tra được dài khoảng 4,01 giây. Kiểm tra
tự động chỉ dùng dữ liệu giả lập và không tiêu hao hạn mức Google.

## Giữ luồng đang dùng

- `/create` tiếp tục dùng luồng tạo video từ ảnh hiện tại, gồm lập nội dung,
  ảnh/bối cảnh, giọng đọc và dựng video như trước. Không phụ thuộc extension,
  server thử nghiệm hoặc hạn mức Google Vids.
- Vids chỉ chạy khi người dùng chủ động gửi tác vụ ở trang thử nghiệm local
  hoặc chọn Vids thử nghiệm tại Bước 3 của `/create` và bấm tạo clip.
- Chế độ Từ ảnh luôn là mặc định mỗi lần mở trang. Không gọi Vids, kiểm tra
  kết nối bridge hoặc tải cache clip khi người dùng đang ở chế độ Từ ảnh.
- Chế độ thử nghiệm chọn tối đa 3 cảnh có ảnh tham chiếu từ kế hoạch hiện có;
  không sửa kịch bản hoặc thời điểm lời đọc. Khoảng 12 giây AI theo mẫu hiện
  tại; nếu nhận clip dài hơn 4,5 giây thì dừng trước khi tạo cảnh tiếp theo.

## Dùng trong Video Studio trên local

### Bản ghép clip mở đầu + ảnh

Clip đầu tiên đã duyệt được dùng làm đoạn mở đầu liên tục, tối đa 8 giây.
Đoạn này không khởi động lại khi chuyển cảnh lời đọc và không sửa thời gian
audio; kết thúc trước CTA nếu video ngắn. Sau clip là các layout ảnh và CTA
của kế hoạch hiện có. Preview, client export và server worker dùng cùng prop
`introVideo`. Các clip bổ sung vẫn theo từng cảnh như trước.

Gemini trả thêm `interaction` trong lượt đọc ảnh sẵn có, gắn với một vị trí
`details` của đúng ảnh: điểm tiếp xúc (cán/viền/thân/bề mặt), món nhỏ có thể
cầm hay cố định, rời/xếp chồng/bị che và độ chắc chắn. Planner ghép các dữ
liệu này thành một thao tác cầm–đặt vào vị trí chuẩn bị, nhấc và giới thiệu,
đặt đạo cụ, chạm hoặc chỉ chi tiết. Tay tiếp cận sớm, thao tác có kết thúc
rõ, không tự reset/lặp lại trong clip. Không mô phỏng hiệu quả chưa có nguồn.
Không còn tra từ khóa tên sản phẩm/nhóm hàng để chọn hành động. Cùng một
vật thể trong ảnh khác nhau có thể nhận thao tác khác nhau. Các món đang
cắm/lồng/xếp chồng không được tách ra; ảnh cận hoặc bao bì không được dùng
để đoán cách vận hành. Tự ưu tiên ảnh có thao tác phù hợp trước ảnh bao bì.

Đề xuất tương tác không trở thành fact/lời quảng cáo. Dữ liệu không hợp lệ
hoặc kế hoạch cũ thiếu `interaction` vẫn chạy bằng cảnh chỉ chi tiết, không
tự gọi lại Gemini/Vids. Phân tích lại sản phẩm ở Bước 1 để nhận dữ liệu mới;
không cần đổi extension 0.3.0. Lựa chọn chuyển động vẫn cần xem và duyệt kết
quả Vids, không thể bảo đảm mọi sản phẩm đều có clip AI đúng hình dáng.

Đây vẫn là luồng thử nghiệm: lựa chọn cảnh không chứng minh clip tạo ra đúng
sản phẩm hoặc qua kiểm duyệt TikTok. Prompt không tự đồng bộ model/thời lượng
với bridge; kiểm tra cấu hình thực tế trước khi dùng hạn mức. Có thể nhập MP4
đã tạo để thử ghép mà không gọi Vids.

1. Chạy app local và `pnpm vids:bridge`, kết nối extension như hướng dẫn dưới.
2. Tạo kế hoạch sản phẩm theo luồng hiện tại, tới Bước 3, chọn **Google Vids —
   thử nghiệm**. Luồng **Từ ảnh — đang dùng** vẫn chọn được để dựng như trước.
3. Dán mã local của bridge, bấm **Kiểm tra kết nối**. Đây là mã local, không
   phải Cookie/token Google; app không lưu mã này lên đĩa.
4. App tìm clip đã lưu theo nội dung ảnh và prompt chuyển động. Có thể tải
   MP4 đã có vào một cảnh để thử dựng mà không gọi Google.
5. Mặc định **Tiết kiệm — tối đa 1 clip** cho mỗi video. Có thể chọn mở rộng
   tối đa 3 clip; các cảnh dùng cùng một asset ảnh không được tạo thêm chỉ vì
   khác câu thoại. Tăng giới hạn vẫn giữ ảnh cắt và clip của cảnh đầu.
   Muốn tạo mới, đánh dấu dùng hạn mức và bấm **Thử 1 clip / tiếp tục tác vụ**.
   App dừng sau clip đầu để kiểm tra sản phẩm, chỉ mở tạo các cảnh còn lại
   khi bạn đã duyệt một clip đúng. Tạo tuần tự, tối đa 3 cảnh; clip hoàn tất lưu ở
   `.data/vids-experiment`. Lỗi hoặc phản hồi không rõ không tự gửi lại Generate.
6. Trong **Chuẩn bị ảnh sạch**, có thể cắt bản sao theo khung Gemini gợi ý,
   điều chỉnh khung hoặc tải ảnh sạch khác. Không vẽ lại hoặc resize sản phẩm;
   khung gợi ý cần kiểm tra vì có thể còn banner hoặc thiếu một phần sản phẩm.
   Xác nhận ảnh còn đủ sản phẩm trước khi tạo mới. Đổi ảnh tra lại cache và
   yêu cầu duyệt lại; không gọi Google khi chuẩn bị ảnh.
   Đối chiếu **Ảnh gửi sang Vids** với **Clip trả về**, kiểm tra cả đầu và
   cuối clip. App trích ba khung đầu–giữa–cuối từ MP4 trên máy để đối chiếu
   nhanh, không gọi Google hoặc AI khác. Vẫn cần xem hết clip; không tự chấm
   đúng sản phẩm chỉ từ ba khung. Đánh dấu **Đã xem: đúng sản phẩm, dùng clip này**. Chỉ clip
   đã duyệt được đưa vào preview và MP4; các cảnh còn lại dùng ảnh gốc.
7. Xuất MP4 bằng các nút hiện có. Clip chạy một lần ở tốc độ gốc, tắt tiếng
   nguồn, trở về ảnh gốc khi hết; lời đọc và phụ đề giữ nguyên thời gian. Không
   tự loop hoặc làm chậm clip để lấp đầy câu thoại. Server render nhận cùng
   clip như preview; khi lỗi không tự đổi bản thử nghiệm thành bản ảnh.

Prompt giới hạn một thao tác nhỏ, giữ nguyên góc nhìn và những món còn lại,
không yêu cầu lộ mặt khuất hoặc vận hành tính năng. Tên sản phẩm không được dùng để mô tả lại
vật thể. Đây là chỉ dẫn, chưa bảo đảm model giữ đúng hình dáng; cơ chế ảnh
tham chiếu của endpoint nội bộ chưa được xác minh là khóa frame đầu. Nếu clip
sai, không duyệt và chưa tạo các cảnh tiếp theo. Các clip của prompt cũ giữ
trên đĩa nhưng không tự dùng lại dưới prompt mới.

Tùy chọn **Khung gọn theo ảnh tham chiếu** gợi ý tỷ lệ từ ảnh đã chọn, thêm
khoảng thở và cắt nền giữa khung; không nhận diện chủ thể hoặc bảo đảm bàn
tay không đi ra ngoài. Toàn khung là mặc định. Xem hết clip trước khi duyệt;
đổi khung tự bỏ duyệt. `frameAspect` dùng chung cho trình phát xem thử, ba
ảnh đối chiếu, Remotion preview, client export và server render. File MP4
nguồn không bị sửa và đổi khung không gọi Google.

Đổi lời đọc hoặc headline giữ nguyên prompt chuyển động nên dùng lại clip.
Đổi ảnh hoặc nội dung prompt tạo một khóa cache khác. Bỏ duyệt clip không xóa
file đã lưu. Chuyển về Từ ảnh ngừng xếp các clip tiếp theo; tác vụ đã gửi vẫn
có thể hoàn tất và dùng hạn mức. Chế độ thử nghiệm chỉ hỗ trợ localhost; app
production tiếp tục dùng Từ ảnh. Một lượt Generate thật đã thành công; kiểm
tra tích hợp nhiều cảnh và MP4 dùng clip giả lập, chưa tạo thêm clip Google.

## Chạy bản thử v0.2.1

Dòng phiên bản lấy trực tiếp từ manifest ngay khi mở cửa sổ, trước khi kết
nối. Bản cũ ghi cố định 0.2.0 ở trạng thái chưa kết nối, gây nhầm với phiên
bản đã cài. Phiên bản script trong tab Vids có thể khác phiên bản extension.
Không cần tạo clip để kiểm tra hoặc sửa dòng phiên bản.

Chẩn đoán chế độ đang hiển thị: `node tools/google-vids-bridge/inspect-ui.mjs`.
Lệnh chỉ đọc tên nút và metadata ô nhập qua extension, không đọc giá trị ô
nhập, Cookie hoặc token Google. `select-animate` chỉ chọn đúng một nút Animate
hiện có; không nhấn Generate, không đoán trường số trong endpoint. Nếu chưa
thấy nút, báo không tìm thấy và không tự chuyển sang chế độ khác. Chưa xác
minh được chế độ Animate thực tế trên tài khoản hiện tại.

1. Chạy `pnpm vids:bridge` tại thư mục project.
2. Mở **http://127.0.0.1:4317**, bấm **Sao chép mã local**.
3. Mở `chrome://extensions`, bật Developer mode, Load unpacked thư mục
   `tools/google-vids-bridge/extension`. Nếu đã cài, bấm Reload extension.
4. Đóng cửa sổ kết nối cũ, mở cửa sổ mới bằng icon extension. Dán mã local,
   chọn tab Vids đã đăng nhập và bấm **Kết nối**.
5. Bản này có cấu hình đã loại bỏ dữ liệu riêng tư từ payload operation 376
   người dùng cung cấp trước đó. Không cần tạo một clip khác để lấy mẫu.
6. Nếu đang chờ phiên, bấm **Làm mới phiên Vids**, mở bảng tạo video trong
   Vids để ứng dụng gửi request kiểm tra hạn mức. Không bấm Generate chỉ để
   làm mới. Đợi extension báo sẵn sàng.
7. Chọn ảnh mới và nhập prompt ở trang local. Có thể **Chỉ kiểm tra upload**
   trước; thao tác này không gọi Generate. Muốn tạo clip, đánh dấu xác nhận
   sử dụng hạn mức rồi bấm **Tạo một clip thử**.
8. Giữ tab Vids, cửa sổ kết nối và local server mở tới khi nhận MP4. File ở
   `output/google-vids-bridge/<job-id>.mp4`, có thể xem/tải trên trang local.

Mỗi lần chạy server tối đa **3 tác vụ**, một tác vụ tại một thời điểm. Restart
server làm đổi mã local. Không tự gửi lại Generate khi lỗi. Ngừng nhận tác vụ
không hủy yêu cầu đã gửi; Google vẫn có thể hoàn tất và tính hạn mức.

## Giữ cấu hình, làm mới phiên

- Đã bỏ mốc hết hạn 5 phút của bản thử cũ. Đây từng là giới hạn do bridge đặt,
  không phải thời hạn token do Google công bố.
- Chrome storage chỉ lưu cấu hình đã kiểm tra, thay document ID, prompt, mã
  ảnh, account selector và ID từng request bằng placeholder. Khi chạy, bridge
  điền tài liệu hiện tại, ảnh/prompt mới và ID mới. Chuỗi không nhận diện được
  sẽ bị từ chối lưu; không lưu raw request để cố giữ cấu hình lạ.
- Header xác thực, API key phía giao diện, server token và URL kết quả chỉ ở
  bộ nhớ tab Vids/cửa sổ extension theo chức năng tương ứng. Không lưu chúng
  vào Chrome storage, local server hoặc log; không xin quyền cookies.
- Bridge quan sát request POST `quotaSummary` thành công của chính Vids để
  nhận phiên hiện tại. Việc quan sát không tạo clip và bridge không tự gọi
  Generate để làm mới. Reload tab mất thông tin phiên, không mất cấu hình.
- Người dùng đã xác nhận một lượt tạo clip thành công sau khi làm mới phiên.
  Chưa bảo đảm token có cùng hiệu lực với mọi tài khoản hoặc lần chạy sau.
  Nếu Google trả 401/403, giữ cấu hình, báo kết nối lại, không tự thử lại hoặc
  yêu cầu tạo clip mẫu thay cho đăng nhập.
- Cấu hình seed giữ nguyên các trường số của payload đã cung cấp. Không đoán
  ý nghĩa model/thời lượng/tỉ lệ. Thay đổi các lựa chọn trên giao diện Vids
  không tự đồng bộ vào seed. Nếu người dùng chủ động tạo một clip hỗ trợ,
  bridge có thể học và lưu cấu hình mới sau khi loại bỏ dữ liệu riêng tư.

## Giới hạn và xử lý lỗi

Chỉ hỗ trợ protobuf-JSON mảng, operation 376, đúng một `Image1`. Đây là endpoint
nội bộ, không phải API tạo video chính thức của Google Vids. Schema, tài khoản
hoặc cách cấp token của Google thay đổi có thể làm bridge không hoạt động.

- `SESSION_RECONNECT_REQUIRED`, HTTP 401/403: làm mới phiên Vids, mở bảng tạo
  video. Không copy Cookie hoặc Google token vào project.
- HTTP 429: dừng và kiểm tra hạn mức Google, không tự thử lại.
- `UPLOAD_START_*`, `UPLOAD_PUT_*`, `INVALID_UPLOAD_RESPONSE`: lỗi ở bước
  upload, không gọi Generate. PUT dùng Blob đúng số byte đã khai báo, header
  `upload, finalize` và offset `0`; người dùng đã xác nhận upload thành công.
- `NO_VIDEO_RESULT`/`REUSED_VIDEO_RESULT`, timeout hoặc tải MP4 lỗi: clip có
  thể đã được tạo. Kiểm tra lịch sử Vids trước khi quyết định tạo lần nữa.
- Một lượt upload → Generate → MP4 đã được xác nhận thành công; chưa kiểm
  chứng nhiều sản phẩm, nhiều cảnh hoặc thay đổi cấu hình model/thời lượng.

Bridge không thay đổi watermark của Google. Kích thước lấy từ response;
không bảo đảm độ trung thực sản phẩm hoặc kết quả tiền kiểm TikTok.

## Phạm vi dữ liệu và kiểm tra

Chỉ quan sát tab `https://docs.google.com/videos/*`. Quyền `scripting` dùng để
chạy trong ngữ cảnh tab; `storage` chỉ dành cho cấu hình đã loại bỏ dữ liệu riêng
tư. Host Google usercontent dùng tải MP4. Signed URL chỉ truyền từ tab tới
extension, không chuyển tới local server.

Server chỉ bind **127.0.0.1:4317**, kiểm tra Host/Origin, dùng mã ngẫu nhiên mỗi
lần chạy, giới hạn kích thước ảnh/MP4. Ảnh và prompt giữ trong bộ nhớ; kết quả
MP4 lưu trong thư mục output đã gitignore.

Chạy `pnpm test:vids-bridge`. Có kiểm tra khôi phục cấu hình sau reload, không
hết hạn sau 5 phút, không lưu thông tin riêng tư, nhận phiên qua quota read,
lỗi đăng nhập vẫn giữ cấu hình và không retry Generate.

Chạy thêm `pnpm test:vids` để kiểm tra chế độ tùy chọn, cache bền qua lần mở
lại, giới hạn số cảnh, khôi phục tác vụ và không gửi trùng Generate. Chạy
`pnpm test:planning` để kiểm tra hồi quy luồng lập nội dung và giọng đọc cũ.
