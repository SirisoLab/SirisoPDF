package stirling.software.SPDF.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class ManagedProcessMonitorTest {

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(TauriProcessMonitor.class);

    @Test
    void unmanagedServerHasNoProcessMonitor() {
        runner.run(
                context ->
                        assertThat(context)
                                .hasNotFailed()
                                .doesNotHaveBean(TauriProcessMonitor.class));
        runner.withPropertyValues(
                        "STIRLING_PDF_TAURI_MODE=false", "STIRLING_PDF_MANAGED_MODE=false")
                .run(
                        context ->
                                assertThat(context)
                                        .hasNotFailed()
                                        .doesNotHaveBean(TauriProcessMonitor.class));
    }

    @Test
    void tauriLauncherKeepsExistingMonitor() {
        runner.withPropertyValues("STIRLING_PDF_TAURI_MODE=true")
                .run(
                        context ->
                                assertThat(context)
                                        .hasNotFailed()
                                        .hasSingleBean(TauriProcessMonitor.class));
    }

    @Test
    void managedLauncherDoesNotNeedTauriMode() {
        runner.withPropertyValues("STIRLING_PDF_TAURI_MODE=false", "STIRLING_PDF_MANAGED_MODE=true")
                .run(
                        context ->
                                assertThat(context)
                                        .hasNotFailed()
                                        .hasSingleBean(TauriProcessMonitor.class));
    }

    @Test
    void readinessPublishesTheActualPortWithoutLeavingTemporaryFiles(@TempDir Path directory)
            throws Exception {
        Path ready = directory.resolve("ready");
        TauriProcessMonitor.writeReadyFile(ready.toString(), 49152);
        assertThat(Files.readString(ready)).isEqualTo("49152\n");
        try (var files = Files.list(directory)) {
            assertThat(files.toList()).containsExactly(ready);
        }
    }

    @Test
    void readinessPublicationIsOptional() throws Exception {
        TauriProcessMonitor.writeReadyFile(null, 8080);
        TauriProcessMonitor.writeReadyFile("", 8080);
    }
}
