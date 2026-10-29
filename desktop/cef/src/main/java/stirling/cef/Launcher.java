package stirling.cef;

import java.awt.BorderLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.List;
import javax.imageio.ImageIO;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import me.friwi.jcefmaven.CefAppBuilder;
import me.friwi.jcefmaven.CefBuildInfo;
import me.friwi.jcefmaven.MavenCefAppHandlerAdapter;
import org.cef.CefApp;
import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.callback.CefBeforeDownloadCallback;
import org.cef.callback.CefDownloadItem;
import org.cef.handler.CefDownloadHandlerAdapter;
import org.cef.handler.CefLifeSpanHandlerAdapter;
import org.cef.handler.CefRequestHandlerAdapter;
import org.cef.network.CefRequest;

/** Runs the core web UI with JCEF; no Tauri or native JavaScript bridge is exposed. */
public final class Launcher {
    public static void main(String[] args) {
        try {
            Path home =
                    Path.of(
                                    Launcher.class
                                            .getProtectionDomain()
                                            .getCodeSource()
                                            .getLocation()
                                            .toURI())
                            .getParent()
                            .getParent();
            Path file = args.length == 0 ? home.resolve("launcher.properties") : Path.of(args[0]);
            if (args.length > 0 && !Files.isRegularFile(file))
                throw new java.io.IOException("Configuration file missing: " + file);
            var config = LauncherConfig.load(file);
            Files.createDirectories(config.dataDir());
            try (var channel =
                            FileChannel.open(
                                    config.dataDir().resolve("launcher.lock"),
                                    StandardOpenOption.CREATE,
                                    StandardOpenOption.WRITE);
                    var lock = channel.tryLock()) {
                if (lock == null)
                    throw new IllegalStateException(
                            "Another CEF instance uses this data directory");
                run(config);
            }
            System.exit(0);
        } catch (Exception e) {
            e.printStackTrace();
            JOptionPane.showMessageDialog(
                    null, e.toString(), "Siriso PDF startup failed", JOptionPane.ERROR_MESSAGE);
            System.exit(1);
        }
    }

    private static void run(LauncherConfig config) throws Exception {
        try (var backend = new Backend(config)) {
            Runtime.getRuntime().addShutdownHook(new Thread(backend::close, "backend-shutdown"));
            var origin = backend.start();
            var builder = new CefAppBuilder();
            var stopped = new java.util.concurrent.CountDownLatch(1);
            builder.setInstallDir(
                    config.dataDir()
                            .resolve("jcef-" + CefBuildInfo.fromClasspath().getReleaseTag())
                            .toFile());
            builder.setMirrors(List.of());
            builder.getCefSettings().windowless_rendering_enabled = false;
            builder.getCefSettings().cache_path = config.dataDir().resolve("browser").toString();
            builder.setAppHandler(
                    new MavenCefAppHandlerAdapter() {
                        @Override
                        public void stateHasChanged(CefApp.CefAppState state) {
                            if (state == CefApp.CefAppState.TERMINATED) stopped.countDown();
                        }
                    });
            var app = builder.build();
            var client = app.createClient();
            client.addRequestHandler(
                    new CefRequestHandlerAdapter() {
                        @Override
                        public boolean onBeforeBrowse(
                                CefBrowser browser,
                                CefFrame frame,
                                CefRequest request,
                                boolean userGesture,
                                boolean redirect) {
                            return frame.isMain() && !Navigation.allowed(origin, request.getURL());
                        }
                    });
            client.addLifeSpanHandler(
                    new CefLifeSpanHandlerAdapter() {
                        @Override
                        public boolean onBeforePopup(
                                CefBrowser browser,
                                CefFrame frame,
                                String targetUrl,
                                String targetFrameName) {
                            return true;
                        }

                        @Override
                        public void onBeforeClose(CefBrowser browser) {
                            app.dispose();
                        }
                    });
            client.addDownloadHandler(
                    new CefDownloadHandlerAdapter() {
                        @Override
                        public boolean onBeforeDownload(
                                CefBrowser browser,
                                CefDownloadItem item,
                                String suggestedName,
                                CefBeforeDownloadCallback callback) {
                            callback.Continue(suggestedName, true);
                            return true;
                        }
                    });
            var windowIcon = ImageIO.read(Launcher.class.getResource("/siriso-logo.png"));
            SwingUtilities.invokeAndWait(
                    () -> {
                        var frame = new JFrame("Siriso PDF");
                        frame.setIconImage(windowIcon);
                        var browser = client.createBrowser(origin + "/", false, false);
                        frame.add(browser.getUIComponent(), BorderLayout.CENTER);
                        frame.setSize(1280, 850);
                        frame.setLocationRelativeTo(null);
                        frame.setDefaultCloseOperation(JFrame.DO_NOTHING_ON_CLOSE);
                        frame.addWindowListener(
                                new WindowAdapter() {
                                    @Override
                                    public void windowClosing(WindowEvent event) {
                                        frame.setEnabled(false);
                                        Thread.ofPlatform()
                                                .name("desktop-close")
                                                .start(
                                                        () -> {
                                                            backend.close();
                                                            SwingUtilities.invokeLater(
                                                                    () -> {
                                                                        browser.close(true);
                                                                        frame.dispose();
                                                                    });
                                                        });
                                    }
                                });
                        backend.onExit()
                                .thenRun(
                                        () -> {
                                            if (!backend.isClosing())
                                                SwingUtilities.invokeLater(
                                                        () -> {
                                                            JOptionPane.showMessageDialog(
                                                                    frame,
                                                                    "PDF backend stopped. See backend.log in "
                                                                            + config.dataDir(),
                                                                    "Backend stopped",
                                                                    JOptionPane.ERROR_MESSAGE);
                                                            frame.dispatchEvent(
                                                                    new WindowEvent(
                                                                            frame,
                                                                            WindowEvent
                                                                                    .WINDOW_CLOSING));
                                                        });
                                        });
                        frame.setVisible(true);
                    });
            stopped.await();
        }
    }
}
