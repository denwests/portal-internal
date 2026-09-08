import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNativePdf = () => Capacitor.isNativePlatform();
let exporting = false;

export async function savePdf(doc, filename) {
  if (exporting) return false;
  exporting = true;
  let path;
  try {
    if (!isNativePdf()) {
      const file = new File([doc.output("blob")], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        if (navigator.userActivation && !navigator.userActivation.isActive) {
          await waitForSaveTap();
        }
        await navigator.share({ files: [file], title: filename });
      } else {
        doc.save(filename);
      }
      return true;
    }
    const safeName = Array.from(filename, (char) => char.charCodeAt(0) < 32 ? "-" : char).join("").replace(/[\\/:*?"<>|]/g, "-");
    path = `pdf-exports/${Date.now()}-${safeName}`;
    const { uri } = await Filesystem.writeFile({
      path, directory: Directory.Cache, recursive: true,
      data: doc.output("datauristring").split(",")[1],
    });
    await Share.share({ title: safeName, files: [uri], dialogTitle: "Simpan PDF" });
    return true;
  } catch (error) {
    if (error?.message !== "Share canceled" && error?.name !== "AbortError") {
      console.error("PDF export failed", error);
      window.alert("PDF belum tersimpan. Silakan coba lagi. " + (error?.message || ""));
    }
    return false;
  } finally {
    if (path) {
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
    }
    exporting = false;
  }
}

/* Render the existing print document in an isolated frame on native iOS. */
export async function saveHtmlPdf(html, filename) {
  const frame = document.createElement("iframe");
  try {
    const { jsPDF } = await import("jspdf");
    const landscape = /size:\s*A4\s+landscape/i.test(html);
    const width = landscape ? 1123 : 794;
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:1123px;border:0;`;
    const ready = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = () => reject(new Error("Gagal menyiapkan laporan PDF."));
    });
    frame.srcdoc = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    document.body.append(frame);
    await ready;
    await frame.contentDocument.fonts.ready;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: landscape ? "landscape" : "portrait" });
    await doc.html(frame.contentDocument.body, {
      margin: [10, 10, 10, 10], autoPaging: "text",
      width: doc.internal.pageSize.getWidth() - 20,
      windowWidth: width,
      html2canvas: { windowWidth: width, backgroundColor: "#ffffff" },
    });
    return await savePdf(doc, filename);
  } catch (error) {
    console.error("PDF rendering failed", error);
    window.alert("Laporan PDF belum bisa dibuat. Silakan coba lagi.");
    return false;
  } finally {
    frame.remove();
  }
}


/* Async report rendering needs a fresh tap before the browser can share. */
function waitForSaveTap() {
  return new Promise((resolve, reject) => {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Simpan PDF");
    dialog.style.cssText = "max-width:300px;padding:24px;border:1px solid #555;border-radius:12px;background:#19191c;color:white;font:16px system-ui";
    const title = document.createElement("p");
    title.textContent = "PDF siap disimpan";
    const save = document.createElement("button");
    save.textContent = "Simpan / Bagikan PDF";
    const cancel = document.createElement("button");
    cancel.textContent = "Batal";
    for (const button of [save, cancel]) button.style.cssText = "padding:12px;margin:4px;font:inherit";
    const abort = () => { dialog.remove(); reject(new DOMException("Canceled", "AbortError")); };
    save.onclick = () => { dialog.remove(); resolve(); };
    cancel.onclick = abort;
    dialog.addEventListener("cancel", abort, { once: true });
    dialog.append(title, save, cancel);
    document.body.append(dialog);
    dialog.showModal();
    save.focus();
  });
}

export const usePdfFileExport = () => isNativePdf() ||
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
