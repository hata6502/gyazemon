const updateOnlineStatus = async () => {
  await electronAPI.updateOnlineStatus(navigator.onLine);
};
await updateOnlineStatus();
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

export {};
