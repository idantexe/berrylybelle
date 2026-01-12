// Konfigurasi Cloudinary
// NOTE: Untuk keamanan Frontend, kita menggunakan "Unsigned Upload".
// API Key dan Secret tidak dimasukkan di sini agar tidak dicuri orang lain.

const CLOUD_NAME = "drs5bj8tq"; 

// PENTING: Pastikan Anda sudah membuat Upload Preset di Dashboard Cloudinary:
// Settings -> Upload -> Add Upload Preset -> Name: "berryly_preset" -> Signing Mode: "Unsigned"
const UPLOAD_PRESET = "berryly_preset"; 

export const uploadToCloudinary = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  // Folder penyimpanan di Cloudinary
  formData.append("folder", "berryly_belle"); 

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      console.error("Cloudinary Error Detail:", errData);
      throw new Error(errData.error?.message || "Failed to upload image");
    }

    const data = await response.json();
    return data.secure_url; // Mengembalikan URL HTTPS gambar yang aman
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};