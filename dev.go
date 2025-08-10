package main

import (
	"log"
	"os"
	"os/exec"
	"runtime"
)

func main() {
	// 构建命令
	cmd := exec.Command("~/go/bin/air", "-c", "node_modules/nuxt-gin-tools/.air.toml")

	// 如果是windows，运行air
	if runtime.GOOS == "windows" {
		cmd = exec.Command("air", "-c", "node_modules/nuxt-gin-tools/.air.toml")
	}

	// 设置标准输出和错误输出
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// 启动命令
	if err := cmd.Start(); err != nil {
		log.Fatalf("Failed to start air: %v", err)
	}

	// 等待命令完成
	if err := cmd.Wait(); err != nil {
		log.Fatalf("Air command finished with error: %v", err)
	}
}
