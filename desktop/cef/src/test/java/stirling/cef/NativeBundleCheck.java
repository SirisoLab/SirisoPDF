package stirling.cef;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import me.friwi.jcefmaven.CefAppBuilder;

/** Verifies offline native extraction from the distribution's classpath without opening a GUI. */
public final class NativeBundleCheck {
    public static void main(String[] args) throws Exception {
        Path destination = Path.of(args[0]);
        var builder = new CefAppBuilder();
        builder.setInstallDir(destination.toFile());
        builder.setMirrors(List.of());
        builder.install();
        if (!Files.isRegularFile(destination.resolve("install.lock"))) {
            throw new IllegalStateException("CEF native extraction did not complete");
        }
        System.out.println("Offline native CEF extraction verified at " + destination);
    }
}
