import Foundation
import PDFKit
let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else { print("usage/failed"); exit(1) }
var out = ""
for i in 0..<doc.pageCount {
    out += "\n\n=== PAGE \(i+1) ===\n"
    out += doc.page(at: i)?.string ?? ""
}
try! out.write(toFile: args[2], atomically: true, encoding: .utf8)
print("pages: \(doc.pageCount) -> \(args[2])")
